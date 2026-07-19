"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isGameLocked, requireCommissioner } from "@/lib/league";
import {
  appUrl,
  emailEnabled,
  inviteEmail,
  makeUnsubscribeToken,
  reminderEmail,
  sendEmail,
} from "@/lib/email";

const deadlineFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

/** Commissioner sends branded invite emails from the admin page. */
export async function sendInviteEmails(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (!emailEnabled()) return;

  const raw = String(formData.get("emails") ?? "");
  const emails = [...new Set(
    raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
  )].slice(0, 25);
  if (emails.length === 0) {
    redirect(`/leagues/${leagueId}/admin?inviteError=${encodeURIComponent("No valid email addresses found.")}`);
  }

  const joinUrl = `${appUrl()}/join/${me.league.inviteCode}`;
  const template = inviteEmail({
    leagueName: me.league.name,
    commishName: me.user.name,
    joinUrl,
  });

  let sent = 0;
  let failed = 0;
  for (const to of emails) {
    const result = await sendEmail({ to, ...template });
    if (result.ok) sent++;
    else failed++;
  }
  redirect(`/leagues/${leagueId}/admin?invitesSent=${sent}&invitesFailed=${failed}`);
}

/** One-click "nudge" for everyone who hasn't finished their picks. */
export async function nudgeMissingPicks(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (!emailEnabled()) return;

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId },
    include: { games: { include: { picks: true } } },
  });
  if (!slate || slate.games.length === 0) return;

  const members = await db.membership.findMany({
    where: { leagueId },
    include: { user: true },
  });
  const needed = me.league.format === "survivor" ? 1 : slate.games.length;
  const openGames = slate.games.some((g) => !isGameLocked(g, slate.pickDeadline));
  if (!openGames) redirect(`/leagues/${leagueId}/admin/slates?nudged=0&nudgeSkipped=locked`);

  const firstOpen = slate.games
    .filter((g) => !isGameLocked(g, slate.pickDeadline))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
  const deadlineLabel = `Picks lock at ${deadlineFmt.format(slate.pickDeadline ?? firstOpen.startTime)}`;
  const picksUrl = `${appUrl()}/leagues/${leagueId}/picks/${slate.id}`;

  let sent = 0;
  for (const m of members) {
    const count = slate.games.reduce(
      (n, g) => n + (g.picks.some((p) => p.membershipId === m.id) ? 1 : 0),
      0
    );
    if (count >= needed || m.user.emailOptOut || m.id === me.id) continue;
    const unsubscribeUrl = `${appUrl()}/api/email/unsubscribe?token=${await makeUnsubscribeToken(m.userId)}`;
    const template = reminderEmail({
      leagueName: me.league.name,
      slateName: slate.name,
      picksUrl,
      deadlineLabel,
      unsubscribeUrl,
      nudge: true,
    });
    const result = await sendEmail({ to: m.user.email, ...template });
    if (result.ok) sent++;
  }
  redirect(`/leagues/${leagueId}/admin/slates?nudged=${sent}`);
}
