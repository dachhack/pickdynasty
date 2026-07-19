import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Signed one-click unsubscribe from reminder/nudge emails. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = await verifyUnsubscribeToken(token);
  const page = (msg: string) =>
    new Response(
      `<!doctype html><body style="background:#0b1120;color:#e2e8f0;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:32px">⚡</p><p>${msg}</p></div></body>`,
      { headers: { "Content-Type": "text/html" }, status: userId ? 200 : 400 }
    );

  if (!userId) return page("That unsubscribe link is invalid or expired.");
  await db.user.update({ where: { id: userId }, data: { emailOptOut: true } }).catch(() => null);
  return page("You're unsubscribed from Epic Pick'em reminder emails. ✅");
}
