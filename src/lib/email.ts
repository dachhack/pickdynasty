import { SignJWT, jwtVerify } from "jose";

// Email via Resend's REST API (no SDK needed). Key-gated like the GIF
// picker: without RESEND_API_KEY every send is a graceful no-op and the
// email UI hides itself.
//
// EMAIL_FROM must use a domain verified in the Resend dashboard, e.g.
//   "Epic Pick'em <commish@epicpickem.com>"
// (Resend's onboarding@resend.dev sender only delivers to your own account
// email — fine for a first smoke test, useless for a league.)

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

const FROM = () => process.env.EMAIL_FROM ?? "Epic Pick'em <onboarding@resend.dev>";

export type SendResult = { ok: boolean; error?: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "email disabled" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [input.to], subject: input.subject, html: input.html }),
      // A slow provider must never stall a page action or the cron run.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

// ---------- Unsubscribe tokens (signed with SESSION_SECRET) ----------

const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret");

export async function makeUnsubscribeToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: "unsub" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("180d")
    .sign(secret());
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === "unsub" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------- Templates ----------

function shell(body: string, footer: string): string {
  return `<!doctype html><body style="margin:0;background:#0b1120;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto">
    <p style="font-size:20px;font-weight:bold;color:#e2e8f0;margin:0 0 16px">⚡ Epic<span style="color:#818cf8">Pick'em</span></p>
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;color:#e2e8f0;font-size:15px;line-height:1.5">
      ${body}
    </div>
    <p style="color:#475569;font-size:12px;margin-top:16px">${footer}</p>
  </div></body>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:bold;padding:12px 22px;border-radius:8px;text-decoration:none;margin-top:12px">${label}</a>`;

export function inviteEmail(input: {
  leagueName: string;
  commishName: string;
  joinUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You're invited to ${input.leagueName} on Epic Pick'em`,
    html: shell(
      `<p><strong>${input.commishName}</strong> invited you to join
       <strong>${input.leagueName}</strong> — a pick'em league on Epic Pick'em.
       Pick winners, talk trash, climb the standings.</p>
       ${button(input.joinUrl, "Join the league")}
       <p style="color:#94a3b8;font-size:13px;margin-top:16px">Or paste this link in your browser:<br>${input.joinUrl}</p>`,
      "You received this because a league commissioner entered your email. If it wasn't meant for you, just ignore it."
    ),
  };
}

export function reminderEmail(input: {
  leagueName: string;
  slateName: string;
  picksUrl: string;
  deadlineLabel: string;
  unsubscribeUrl: string;
  nudge?: boolean;
}): { subject: string; html: string } {
  return {
    subject: input.nudge
      ? `⏰ Your commissioner wants your picks — ${input.slateName}, ${input.leagueName}`
      : `⏰ Picks lock soon — ${input.slateName}, ${input.leagueName}`,
    html: shell(
      `<p>You haven't finished your picks for <strong>${input.slateName}</strong> in
       <strong>${input.leagueName}</strong>.</p>
       <p>⏰ ${input.deadlineLabel}</p>
       ${button(input.picksUrl, "Make my picks")}`,
      `Don't want these emails? <a href="${input.unsubscribeUrl}" style="color:#64748b">Unsubscribe</a>.`
    ),
  };
}
