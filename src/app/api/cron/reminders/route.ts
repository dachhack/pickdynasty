import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isGameLocked } from "@/lib/league";
import {
  appUrl,
  emailEnabled,
  makeUnsubscribeToken,
  reminderEmail,
  sendEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const deadlineFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

/**
 * Automated deadline reminders — hit on a schedule by the GitHub Actions
 * workflow. Emails every member with unfinished picks on a slate whose
 * games start locking within the next 24h. ReminderLog guarantees at most
 * one automated email per member per slate.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 3600 * 1000);

  // Slates with a game locking inside the window.
  const slates = await db.slate.findMany({
    where: { games: { some: { startTime: { gt: now, lte: windowEnd } } } },
    include: {
      games: { include: { picks: true } },
      league: { include: { memberships: { include: { user: true } } } },
      reminderLogs: true,
    },
  });

  let candidates = 0;
  let sent = 0;
  let failed = 0;

  for (const slate of slates) {
    const needed = slate.league.format === "survivor" ? 1 : slate.games.length;
    const firstUpcoming = slate.games
      .filter((g) => !isGameLocked(g, slate.pickDeadline))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
    if (!firstUpcoming) continue;
    const deadlineLabel = `Picks lock at ${deadlineFmt.format(slate.pickDeadline ?? firstUpcoming.startTime)}`;
    const picksUrl = `${appUrl()}/leagues/${slate.leagueId}/picks/${slate.id}`;
    const reminded = new Set(slate.reminderLogs.map((r) => r.membershipId));

    for (const m of slate.league.memberships) {
      const count = slate.games.reduce(
        (n, g) => n + (g.picks.some((p) => p.membershipId === m.id) ? 1 : 0),
        0
      );
      if (count >= needed || reminded.has(m.id) || m.user.emailOptOut) continue;
      candidates++;
      if (!emailEnabled()) continue; // dry mode: report who WOULD be emailed

      const unsubscribeUrl = `${appUrl()}/api/email/unsubscribe?token=${await makeUnsubscribeToken(m.userId)}`;
      const template = reminderEmail({
        leagueName: slate.league.name,
        slateName: slate.name,
        picksUrl,
        deadlineLabel,
        unsubscribeUrl,
      });
      const result = await sendEmail({ to: m.user.email, ...template });
      if (result.ok) {
        sent++;
        await db.reminderLog.create({ data: { slateId: slate.id, membershipId: m.id } });
      } else {
        failed++;
      }
    }
  }

  return NextResponse.json({
    emailEnabled: emailEnabled(),
    slatesInWindow: slates.length,
    candidates,
    sent,
    failed,
  });
}
