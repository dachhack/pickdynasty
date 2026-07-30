import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadLeagueForStandings, slateScores } from "@/lib/league";

export const dynamic = "force-dynamic";

// Personal result share card (1080x1080): fetched by the Share button and
// pushed into the phone's share sheet. Members can only render their own.

const GOLD = "#fbbf24";
const NAVY = "#14213d";

function Trophy({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill={NAVY} />
      <path d="M160 112 h192 v84 a96 96 0 0 1 -192 0 z" fill={GOLD} />
      <path
        d="M160 128 h-44 a12 12 0 0 0 -12 12 c0 52 34 86 76 92 M352 128 h44 a12 12 0 0 1 12 12 c0 52 -34 86 -76 92"
        fill="none"
        stroke={GOLD}
        strokeWidth="26"
      />
      <path d="M236 288 h40 l10 62 h-60 z" fill={GOLD} />
      <rect x="188" y="350" width="136" height="34" rx="8" fill={GOLD} />
      <rect x="168" y="384" width="176" height="26" rx="8" fill={GOLD} />
      <path
        d="M206 182 l34 36 66 -76"
        fill="none"
        stroke={NAVY}
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string; slateId: string }> }
) {
  const { leagueId, slateId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
  });
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const league = await loadLeagueForStandings(leagueId);
  const slate = league.slates.find((s) => s.id === slateId);
  if (!slate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const scores = slateScores(league, slateId);
  const mine = scores.find((s) => s.membershipId === membership.id);
  const ranked = [...scores].sort((a, b) => b.points - a.points);
  const rank = ranked.findIndex((s) => s.membershipId === membership.id) + 1;
  const isWinner = rank === 1 && (mine?.points ?? 0) > 0;
  const final = slate.games.length > 0 && slate.games.every((g) => g.winner);

  // Plain text only — the OG renderer shows emoji as tofu without
  // fetching external glyph art at request time.
  const headline =
    league.format === "survivor"
      ? (mine?.correct ?? 0) > 0
        ? "Survived"
        : (mine?.decided ?? 0) > 0
          ? "Eliminated"
          : "No pick"
      : `${mine?.correct ?? 0} of ${mine?.decided ?? 0}`;
  const sub =
    league.format === "confidence"
      ? `${mine?.points ?? 0} pts · #${rank} of ${scores.length} this slate`
      : `#${rank} of ${scores.length} this slate`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(160deg, #0b1120 0%, #1a2b52 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Trophy px={72} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>
            Epic Pick&apos;em
          </div>
        </div>

        <div style={{ marginTop: 44, fontSize: 38, color: "#94a3b8" }}>
          {`${league.name} · ${slate.name}${final ? "" : " (so far)"}`}
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: membership.teamColor,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          {membership.teamName}
        </div>

        <div style={{ marginTop: 30, fontSize: 170, fontWeight: 700, lineHeight: 1 }}>
          {headline}
        </div>
        <div style={{ marginTop: 26, fontSize: 44, color: "#94a3b8" }}>{sub}</div>

        {isWinner && final && (
          <div
            style={{
              marginTop: 40,
              background: GOLD,
              color: NAVY,
              borderRadius: 18,
              padding: "18px 44px",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            Slate winner
          </div>
        )}

        <div style={{ marginTop: "auto", fontSize: 34, color: "#64748b" }}>
          think you can beat me? epicpickem.com
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
