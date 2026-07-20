"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { BuilderGame } from "@/actions/wizard";
import { tapHaptic } from "@/components/boards/celebrate";

type SportInfo = { id: string; label: string; emoji: string };
type Team = { id: string; name: string; abbrev: string };
type PoolGame = BuilderGame & { completed: boolean };
type PackInfo = { id: string; title: string; emoji: string; description: string };
export type BuilderSaveResult = { ok: true; redirectTo: string } | { ok: false; error: string };

const timeFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const keyOf = (g: PoolGame) => `${g.sport}:${g.externalId}`;

/**
 * Drag-and-drop slate builder: browse the game pool by week, day, or team
 * (any ESPN sport, any season) and drag — or tap + — games into your slate.
 * The slate accumulates across queries, so one slate can mix sports.
 */
export default function SlateBuilder({
  leagueId,
  leagueSport,
  leagueSeason,
  sports,
  weeklyMax,
  todayISO,
  action,
  saveLabel = "Create slate",
  initialSlate = [],
  initialName = "",
}: {
  leagueId: string; // league id, or "hq" for the pack editor
  leagueSport: string;
  leagueSeason: string;
  sports: SportInfo[];
  weeklyMax: Record<string, number>;
  todayISO: string; // YYYY-MM-DD in ET
  action: (input: { name: string; games: BuilderGame[] }) => Promise<BuilderSaveResult>;
  saveLabel?: string;
  initialSlate?: PoolGame[];
  initialName?: string;
}) {
  const router = useRouter();
  const [sport, setSport] = useState(leagueSport);
  const weekly = sport in weeklyMax;
  const [mode, setMode] = useState<"packs" | "week" | "day" | "team">(weekly ? "week" : "day");
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [packId, setPackId] = useState("");
  const [season, setSeason] = useState(leagueSeason);
  const [week, setWeek] = useState(1);
  const [date, setDate] = useState(todayISO);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [pool, setPool] = useState<PoolGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [poolError, setPoolError] = useState("");
  const [slate, setSlate] = useState<PoolGame[]>(initialSlate);
  const [name, setName] = useState(initialName);
  const nameTouched = useRef(Boolean(initialName));
  const [dragging, setDragging] = useState<PoolGame | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, startSave] = useTransition();

  const chosen = useMemo(() => new Set(slate.map(keyOf)), [slate]);

  // Switching sport resets mode-appropriate state.
  function pickSport(id: string) {
    setSport(id);
    setTeams([]);
    setTeamId("");
    setPool([]);
    const isWeekly = id in weeklyMax;
    setMode((m) => (m === "week" && !isWeekly ? "day" : m === "team" ? "team" : isWeekly ? "week" : "day"));
  }

  const query = useCallback(async () => {
    setLoading(true);
    setPoolError("");
    try {
      let url = "";
      if (mode === "week") url = `/api/leagues/${leagueId}/espn?mode=week&sport=${sport}&season=${season}&week=${week}`;
      else if (mode === "day") url = `/api/leagues/${leagueId}/espn?mode=day&sport=${sport}&date=${date.replaceAll("-", "")}`;
      else if (mode === "team" && teamId)
        url = `/api/leagues/${leagueId}/espn?mode=team&sport=${sport}&team=${teamId}&season=${season}`;
      else if (mode === "packs" && packId)
        url = `/api/leagues/${leagueId}/espn?mode=pack&pack=${encodeURIComponent(packId)}&season=${season}`;
      if (!url) {
        setPool([]);
        setLoading(false);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setPoolError(data.error);
      setPool(data.games ?? []);
      // Suggest a slate name from the first query if the commish hasn't typed one.
      if (!nameTouched.current && (data.games ?? []).length > 0) {
        const sportPrefix = mode === "packs" || sport === leagueSport ? "" : `${sports.find((s) => s.id === sport)?.label ?? sport} · `;
        const label =
          mode === "packs"
            ? packs.find((pk) => pk.id === packId)?.title ?? "Pick pack"
            : mode === "week"
              ? `Week ${week}`
              : mode === "day"
                ? timeFmt.format(new Date(`${date}T12:00:00-05:00`)).split(",").slice(0, 2).join(",")
                : `${teams.find((t) => t.id === teamId)?.name ?? "Team"} schedule`;
        setName(`${sportPrefix}${label}`);
      }
    } catch {
      setPoolError("Couldn't load the schedule — try again.");
    }
    setLoading(false);
  }, [leagueId, mode, sport, season, week, date, teamId, packId, packs, leagueSport, sports, teams]);

  // Debounced so season typing / rapid tab-switching doesn't storm ESPN.
  useEffect(() => {
    const t = setTimeout(query, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sport, season, week, date, teamId, packId]);

  // Lazy-load the pack list when entering packs mode.
  useEffect(() => {
    if (mode !== "packs" || packs.length > 0) return;
    (async () => {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/espn?mode=packs`);
        const data = await res.json();
        setPacks(data.packs ?? []);
      } catch {
        setPoolError("Couldn't load packs.");
      }
    })();
  }, [mode, packs.length, leagueId]);

  // Lazy-load the team list when entering team mode.
  useEffect(() => {
    if (mode !== "team" || teams.length > 0) return;
    (async () => {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/espn?mode=teams&sport=${sport}`);
        const data = await res.json();
        setTeams(data.teams ?? []);
      } catch {
        setPoolError("Couldn't load teams.");
      }
    })();
  }, [mode, sport, teams.length, leagueId]);

  function addAll() {
    tapHaptic();
    setSlate((prev) => {
      const have = new Set(prev.map(keyOf));
      const fresh = pool.filter((g) => !have.has(keyOf(g)));
      return [...prev, ...fresh].slice(0, 64);
    });
  }

  function add(g: PoolGame) {
    if (chosen.has(keyOf(g))) return;
    tapHaptic();
    setSlate((prev) => [...prev, g]);
  }
  function remove(key: string) {
    setSlate((prev) => prev.filter((g) => keyOf(g) !== key));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragStart(e: DragStartEvent) {
    const g = pool.find((x) => keyOf(x) === String(e.active.id));
    setDragging(g ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (e.over?.id === "slate-drop") {
      const g = pool.find((x) => keyOf(x) === String(e.active.id));
      if (g) add(g);
    }
  }

  function create() {
    setSaveError("");
    startSave(async () => {
      const result = await action({ name, games: slate });
      if (result.ok) router.push(result.redirectTo);
      else setSaveError(result.error);
    });
  }

  const sportMeta = (id: string | null) => sports.find((s) => s.id === (id ?? leagueSport));

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Pool ---- */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            {sports.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSport(s.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  s.id === sport
                    ? "border-indigo-500 bg-indigo-950/50 text-white"
                    : "border-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs font-semibold">
              {(weekly ? (["week", "day", "team", "packs"] as const) : (["day", "team", "packs"] as const)).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 capitalize ${
                    mode === m ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {m === "packs" ? "🎁 Packs" : `By ${m}`}
                </button>
              ))}
            </div>
            {mode === "week" && (
              <select className="input !w-auto !py-1.5 !text-sm" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                {Array.from({ length: weeklyMax[sport] ?? 18 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            )}
            {mode === "day" && (
              <input className="input !w-auto !py-1.5 !text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            )}
            {mode === "team" && (
              <select className="input !w-auto max-w-[14rem] !py-1.5 !text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Pick a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {(mode === "week" || mode === "team") && (
              <input
                className="input !w-24 !py-1.5 !text-sm"
                value={season}
                onChange={(e) => setSeason(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Season"
                title="Season"
              />
            )}
          </div>

          {mode === "packs" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {packs.length === 0 && <p className="text-sm text-slate-500">Loading packs…</p>}
              {packs.map((pk) => (
                <button
                  key={pk.id}
                  type="button"
                  onClick={() => setPackId(pk.id)}
                  title={pk.description}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    packId === pk.id
                      ? "border-indigo-500 bg-indigo-950/50 text-white"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {pk.emoji} {pk.title}
                </button>
              ))}
            </div>
          )}

          {pool.length > 0 && !loading && (
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={addAll} className="btn-ghost !px-2.5 !py-1 !text-xs">
                ⬇️ Add all {pool.length}
              </button>
            </div>
          )}

          <div className="mt-3 flex max-h-[24rem] flex-col gap-1.5 overflow-y-auto pr-1">
            {loading && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
            {!loading && poolError && <p className="py-4 text-center text-sm text-red-400">{poolError}</p>}
            {!loading && !poolError && pool.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                {mode === "team" && !teamId
                  ? "Pick a team to see its schedule."
                  : mode === "packs" && !packId
                    ? "Pick a pack — curated bundles you can add in one tap."
                    : "No games found."}
              </p>
            )}
            {!loading &&
              pool.map((g) => {
                const inSlate = chosen.has(keyOf(g));
                return (
                  <PoolCard key={keyOf(g)} game={g} disabled={inSlate} onAdd={() => add(g)} emoji={sportMeta(g.sport)?.emoji ?? "🏆"} />
                );
              })}
          </div>
        </div>

        {/* ---- Slate tray ---- */}
        <SlateTray
          slate={slate}
          onRemove={remove}
          name={name}
          onName={(v) => {
            nameTouched.current = true;
            setName(v);
          }}
          onCreate={create}
          saving={saving}
          saveError={saveError}
          emojiOf={(g) => sportMeta(g.sport)?.emoji ?? "🏆"}
          saveLabel={saveLabel}
        />
      </div>

      <DragOverlay>
        {dragging && (
          <div className="rounded-lg border border-indigo-500 bg-slate-900 px-3 py-2 text-sm font-semibold shadow-xl">
            {dragging.awayTeam} @ {dragging.homeTeam}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PoolCard({
  game,
  disabled,
  onAdd,
  emoji,
}: {
  game: PoolGame;
  disabled: boolean;
  onAdd: () => void;
  emoji: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: keyOf(game),
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        disabled
          ? "border-slate-800 opacity-40"
          : "cursor-grab touch-none border-slate-700 hover:border-slate-500 active:cursor-grabbing"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <span className="shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {game.awayTeam} @ {game.homeTeam}
        </p>
        <p className="text-xs text-slate-500">
          {game.completed
            ? `Final${game.homeScore != null ? ` ${game.awayScore}–${game.homeScore}` : ""}`
            : timeFmt.format(new Date(game.startTime))}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="btn-ghost shrink-0 !px-2.5 !py-1 !text-sm"
        aria-label={`Add ${game.awayTeam} at ${game.homeTeam}`}
      >
        {disabled ? "✓" : "+"}
      </button>
    </div>
  );
}

function SlateTray({
  slate,
  onRemove,
  name,
  onName,
  onCreate,
  saving,
  saveError,
  emojiOf,
  saveLabel,
}: {
  slate: PoolGame[];
  onRemove: (key: string) => void;
  name: string;
  onName: (v: string) => void;
  onCreate: () => void;
  saving: boolean;
  saveError: string;
  emojiOf: (g: PoolGame) => string;
  saveLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "slate-drop" });
  return (
    <div
      ref={setNodeRef}
      className={`card flex flex-col transition-colors ${isOver ? "border-indigo-500 bg-indigo-950/20" : ""}`}
    >
      <h3 className="font-bold">
        Your slate <span className="text-sm font-normal text-slate-500">— drag games here or tap +</span>
      </h3>
      <div className="mt-3 flex min-h-[10rem] flex-1 flex-col gap-1.5 overflow-y-auto">
        {slate.length === 0 && (
          <p className={`flex flex-1 items-center justify-center rounded-lg border border-dashed py-10 text-sm ${isOver ? "border-indigo-500 text-indigo-300" : "border-slate-700 text-slate-500"}`}>
            {isOver ? "Drop it! 🎯" : "Empty slate — build it from the pool"}
          </p>
        )}
        {slate.map((g) => (
          <div key={keyOf(g)} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="shrink-0">{emojiOf(g)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {g.awayTeam} @ {g.homeTeam}
              </p>
              <p className="text-xs text-slate-500">
                {g.completed ? "Final" : timeFmt.format(new Date(g.startTime))}
              </p>
            </div>
            <button type="button" onClick={() => onRemove(keyOf(g))} className="btn-danger shrink-0">
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-800 pt-4">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="slate-name">Slate name</label>
          <input
            id="slate-name"
            className="input"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Week 3, Rivalry Weekend…"
          />
        </div>
        <button type="button" onClick={onCreate} disabled={saving || slate.length === 0} className="btn">
          {saving ? "Saving…" : `${saveLabel} · ${slate.length} game${slate.length === 1 ? "" : "s"}`}
        </button>
      </div>
      {saveError && <p className="mt-2 text-sm text-red-400">{saveError}</p>}
    </div>
  );
}
