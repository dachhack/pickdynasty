// ESPN feed canary — run daily by .github/workflows/espn-canary.yml.
// Fails loudly (non-zero exit) when the public ESPN API changes shape or
// stops answering, so feed breakage shows up as a red workflow run instead
// of a quietly stale scoreboard. Dependency-free: plain fetch, Node 20+.
//
// Checks, tolerant of off-seasons:
//   1. Teams endpoints for core sports return a plausible team list.
//   2. Across a 7-day scoreboard window over all year-round sports, at
//      least one event exists somewhere (MLB/WNBA/MLS cover the summer).
//   3. Every event found has the fields the app's parser depends on.

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const PATHS = {
  nfl: "football/nfl",
  cfb: "football/college-football",
  mlb: "baseball/mlb",
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  nhl: "hockey/nhl",
  mls: "soccer/usa.1",
};

const failures = [];
const note = (msg) => console.log(`  ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.error(`  ❌ ${msg}`);
};

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- 1. Team lists (populated year-round) ----
console.log("Teams endpoints:");
for (const sport of ["nfl", "mlb", "nba", "wnba"]) {
  const url = `${BASE}/${PATHS[sport]}/teams`;
  try {
    const data = await getJson(url);
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    const ok =
      teams.length >= 8 &&
      teams.every((t) => t?.team?.id && t?.team?.displayName);
    if (ok) note(`✅ ${sport}: ${teams.length} teams`);
    else fail(`${sport} teams: unexpected shape (${teams.length} entries)`);
  } catch (e) {
    fail(`${sport} teams: ${e.message}`);
  }
}

// ---- 2 & 3. Scoreboard window + event shape ----
console.log("Scoreboards (7-day window):");
const d = (offset) => {
  const t = new Date(Date.now() + offset * 24 * 3600 * 1000);
  return t.toISOString().slice(0, 10).replace(/-/g, "");
};
const range = `${d(0)}-${d(7)}`;
let totalEvents = 0;

for (const [sport, path] of Object.entries(PATHS)) {
  const url = `${BASE}/${path}/scoreboard?dates=${range}&limit=200`;
  try {
    const data = await getJson(url);
    const events = data?.events ?? [];
    totalEvents += events.length;
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      if (!ev?.id || !comp?.date || !home?.team?.displayName || !away?.team?.displayName) {
        fail(`${sport} event ${ev?.id ?? "?"}: missing id/date/competitor fields`);
        break; // one shape failure per sport is enough signal
      }
    }
    note(`✅ ${sport}: ${events.length} events, shape ok`);
  } catch (e) {
    fail(`${sport} scoreboard: ${e.message}`);
  }
}

if (totalEvents === 0) {
  fail("no events in the next 7 days across ANY sport — feed likely broken");
}

if (failures.length > 0) {
  console.error(`\nCANARY FAILED (${failures.length}):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`\nCanary green: ${totalEvents} events visible, all shapes intact.`);
