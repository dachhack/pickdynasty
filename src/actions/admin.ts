"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { makeInviteCode, requireCommissioner } from "@/lib/league";
import { propFamily, propStat, suggestLine } from "@/lib/props";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";

export async function updateLeagueSettings(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim();
  const buyIn = Number(formData.get("buyIn") ?? 0) || 0;
  const format = String(formData.get("format") ?? "");

  await db.league.update({
    where: { id: leagueId },
    data: {
      ...(name ? { name } : {}),
      ...(season ? { season } : {}),
      ...(["classic", "confidence", "survivor", "spread"].includes(format) ? { format } : {}),
      buyIn,
      blindPicks: formData.get("blindPicks") === "on",
      adminCanSeePicks: formData.get("adminCanSeePicks") === "on",
    },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin?saved=1`);
}

/** 🍻 Event night mode: guest quick-join, TV leaderboard, venue geofence. */
export async function updateEventSettings(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);

  const allowGuests = formData.get("allowGuests") === "on";
  let requireLocation = formData.get("requireLocation") === "on";

  const coord = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  const venueLat = coord("venueLat");
  const venueLng = coord("venueLng");
  const radius = Number(formData.get("venueRadiusM") ?? 0);
  const venueRadiusM = VENUE_RADIUS_OPTIONS.some((o) => o.value === radius)
    ? radius
    : me.league.venueRadiusM;

  // Location check needs a venue point — freshly captured or already saved.
  const hasVenue =
    (venueLat != null && venueLng != null) ||
    (me.league.venueLat != null && me.league.venueLng != null);
  if (requireLocation && !hasVenue) {
    requireLocation = false;
    await db.league.update({
      where: { id: leagueId },
      data: { allowGuests, requireLocation, venueRadiusM },
    });
    redirect(`/leagues/${leagueId}/admin?eventError=no-venue`);
  }

  await db.league.update({
    where: { id: leagueId },
    data: {
      allowGuests,
      requireLocation,
      venueRadiusM,
      ...(venueLat != null && venueLng != null ? { venueLat, venueLng } : {}),
    },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin?saved=1`);
}

/** Commissioner's league notes — rules, payouts, house rules. */
export async function updateLeagueNotes(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  const notes = String(formData.get("notes") ?? "").slice(0, 4000);
  await db.league.update({ where: { id: leagueId }, data: { notes } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin?saved=1`);
}

export async function regenerateInviteCode(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  await db.league.update({
    where: { id: leagueId },
    data: { inviteCode: makeInviteCode() },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function removeMember(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (membershipId === me.id) return; // can't remove yourself

  await db.membership.deleteMany({ where: { id: membershipId, leagueId } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}

export async function toggleRole(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (membershipId === me.id) return; // keep at least one commissioner

  const target = await db.membership.findFirst({ where: { id: membershipId, leagueId } });
  if (!target) return;
  await db.membership.update({
    where: { id: target.id },
    data: { role: target.role === "COMMISSIONER" ? "PLAYER" : "COMMISSIONER" },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

/** Drag-to-reorder slates from the admin order strip. */
export async function reorderSlates(input: {
  leagueId: string;
  orderedSlateIds: string[];
}): Promise<void> {
  await requireCommissioner(input.leagueId);
  const slates = await db.slate.findMany({ where: { leagueId: input.leagueId } });
  const valid = new Set(slates.map((s) => s.id));
  let order = 0;
  for (const id of input.orderedSlateIds) {
    if (!valid.has(id)) continue;
    await db.slate.update({ where: { id }, data: { order: order++ } });
  }
  revalidatePath(`/leagues/${input.leagueId}`, "layout");
}

export async function createSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const deadlineRaw = String(formData.get("pickDeadline") ?? "");
  const count = await db.slate.count({ where: { leagueId } });

  await db.slate.create({
    data: {
      leagueId,
      name,
      order: count,
      pickDeadline: deadlineRaw ? new Date(deadlineRaw) : null,
    },
  });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

export async function deleteSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  await requireCommissioner(leagueId);
  await db.slate.deleteMany({ where: { id: slateId, leagueId } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}

export async function addGame(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  await requireCommissioner(leagueId);

  const slate = await db.slate.findFirst({ where: { id: slateId, leagueId } });
  if (!slate) return;

  const awayTeam = String(formData.get("awayTeam") ?? "").trim();
  const homeTeam = String(formData.get("homeTeam") ?? "").trim();
  const startRaw = String(formData.get("startTime") ?? "");
  if (!awayTeam || !homeTeam || !startRaw) return;

  await db.game.create({
    data: { slateId, awayTeam, homeTeam, startTime: new Date(startRaw) },
  });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

/**
 * 🎯 Adds a player prop to a slate, attached to one of the slate's games
 * (inherits its start time for locking and its ESPN event for grading).
 * A blank line auto-fills from Sleeper projections (NFL); otherwise the
 * commissioner types the number. Blocked in survivor/spread formats.
 */
export async function addProp(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const me = await requireCommissioner(leagueId);
  const back = `/leagues/${leagueId}/admin/slates`;

  if (["survivor", "spread"].includes(me.league.format)) {
    redirect(`${back}?propError=format`);
  }

  const gameId = String(formData.get("gameId") ?? "");
  const game = await db.game.findFirst({
    where: { id: gameId, slateId, kind: "match", slate: { leagueId } },
  });
  if (!game) redirect(`${back}?propError=game`);

  const playerName = String(formData.get("playerName") ?? "").trim().slice(0, 60);
  const statKey = String(formData.get("statKey") ?? "");
  const sport = game.sport ?? me.league.sport;
  const def = propStat(statKey);
  if (!playerName || !def || def.family !== propFamily(sport)) {
    redirect(`${back}?propError=stat`);
  }

  const lineRaw = String(formData.get("line") ?? "").trim();
  let line = lineRaw ? Number(lineRaw) : null;
  if (line != null && !Number.isFinite(line)) line = null;
  if (line == null && !lineRaw) {
    line = await suggestLine({ sport, playerName, statKey });
  }
  if (line == null) redirect(`${back}?propError=line`);

  await db.game.create({
    data: {
      slateId,
      kind: "prop",
      awayTeam: "Over",
      homeTeam: "Under",
      startTime: game.startTime,
      sport: game.sport,
      externalId: game.externalId, // null on hand-entered games → manual grading
      propLabel: `${playerName} · ${def.label}`,
      propPlayer: playerName,
      propStat: def.key,
      line,
    },
  });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
  redirect(back);
}

export async function deleteGame(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  await requireCommissioner(leagueId);
  await db.game.deleteMany({ where: { id: gameId, slate: { leagueId } } });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

export async function setResult(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const winner = String(formData.get("winner") ?? "");
  await requireCommissioner(leagueId);

  if (!["HOME", "AWAY", "TIE", "CLEAR"].includes(winner)) return;
  const game = await db.game.findFirst({ where: { id: gameId, slate: { leagueId } } });
  if (!game) return;

  await db.game.update({
    where: { id: game.id },
    data: { winner: winner === "CLEAR" ? null : winner },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}
