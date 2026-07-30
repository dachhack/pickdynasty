import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { sportLabel } from "@/lib/sports";

// Dynamic share card for league invite links: the unfurl shows the actual
// league name and sport, so a /join/<code> link dropped in a group chat
// looks like an invitation, not a bare URL.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "You're invited to a pick'em league on Epic Pick'em";

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

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const league = await db.league
    .findUnique({
      where: { inviteCode: code.toUpperCase() },
      include: { _count: { select: { memberships: true } } },
    })
    .catch(() => null);

  const name = league?.name ?? "A pick'em league";
  const sub = league
    ? `${sportLabel(league.sport)} · ${league.season} season · ${league._count.memberships} ${league._count.memberships === 1 ? "player" : "players"}`
    : "Epic Pick'em";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          backgroundImage: "linear-gradient(135deg, #0b1120 0%, #1a2b52 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Trophy px={110} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, color: "#94a3b8" }}>
              Epic Pick&apos;em invite
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: GOLD }}>
              You&apos;re invited to play
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 46,
            fontSize: name.length > 24 ? 72 : 92,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {name}
        </div>
        <div style={{ marginTop: 28, fontSize: 38, color: "#94a3b8" }}>
          {sub}
        </div>
        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "#4f46e5",
              borderRadius: 14,
              padding: "16px 34px",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            Tap to make your picks
          </div>
          <div style={{ fontSize: 30, color: "#64748b" }}>epicpickem.com</div>
        </div>
      </div>
    ),
    size
  );
}
