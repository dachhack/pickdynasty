# HANDOFF — Epic Pick'em working notes

> In-repo WIP notes for whoever (or whatever) works here next.
> The short outward-facing summary lives in STATUS.md — keep both current.

## What this is

Epic Pick'em (epicpickem.com): pick'em leagues with friends across every sport.
Next.js 16 App Router + React 19 + Tailwind 4 + Prisma 6 on Postgres. Live in
production on Fly.io with the domain, certs, shared Supabase auth, Google
sign-in, and branded email all working.

## Environments

| | URL | Fly app | Deploy |
|---|---|---|---|
| Staging | epicpickem-staging.fly.dev | `epicpickem-staging` | auto on push to `main` (+ manual button) |
| Production | epicpickem.com (+ www) | `epicpickem` | **manual**: Actions → "Deploy production (Fly)" |

- Git convention this project has used: develop on the designated feature
  branch, push every commit to BOTH the branch and `main` (`git push origin
  <branch>:main`). `main` is the default branch and drives staging.
- Images run `prisma migrate deploy` on boot; the deploy workflows also run
  it from the runner first as a fail-fast (and "Verify production database"
  workflow does only that step, for checking DB secrets).
- Migrations are HAND-WRITTEN (prisma migrate dev's shadow DB fights RLS).
  Pattern: write SQL in prisma/migrations/<stamp>_<name>/migration.sql,
  matching schema.prisma edit, `npx prisma@6 migrate deploy`. Enable RLS on
  every new table (deny-all; Prisma connects as table owner and bypasses).

## Providers (shared stack with Drip League FF / dachhack/ffgame)

- **Supabase**: ONE project shared with Drip (ref `kaoitimdsftclykhqaqx`).
  Epic's tables live in the dedicated **`epicpickem` schema** (connection
  strings carry `?schema=epicpickem` / `&schema=epicpickem` — this avoided
  Prisma P3005 against Drip's populated `public` schema). Auth is shared:
  same auth.users = one account across both products.
- **Auth drivers** (src/lib/auth.ts): Supabase when NEXT_PUBLIC_SUPABASE_*
  present, self-contained JWT cookie (`ep_session`) otherwise — AND the JWT
  cookie is always checked as fallback (bar-night guests ride it in prod).
  Google OAuth via Supabase PKCE (/auth/callback; guest claim absorbs the
  device's guest account). Forgot password (/forgot-password →
  /reset-password): Supabase driver uses resetPasswordForEmail with
  redirectTo /auth/callback?next=/reset-password (the OAuth callback doubles
  as the recovery landing — that URL must stay in the Supabase project's
  allowed redirect list, same entry OAuth already needs), then
  auth.updateUser; local driver emails a 30-min signed JWT that embeds a
  sha256 fingerprint of the current passwordHash, making it single-use
  (fingerprint dies when the hash changes). Guests excluded; response never
  reveals whether an email has an account.
- **Branded auth emails** (src/lib/authEmails.ts): the shared Supabase
  project's stock templates are Drip-branded, so when SUPABASE_SECRET_KEY
  (an sb_secret_... API key; legacy service_role JWT accepted via
  SUPABASE_SERVICE_ROLE_KEY) + SMTP are set, Epic mints auth links itself
  (auth.admin.generateLink — returns the link, sends NOTHING) and emails
  them via its own sender; /auth/confirm verifies the token_hash
  (verifyOtp, signs the user in) and forwards to `next`. Covers signup,
  guest claim, and password recovery. Without the key each flow falls back
  to Supabase-sent (Drip-branded) emails. Send-failure rolls back the
  just-created unconfirmed user so retries don't hit "already exists".
  Drip's own templates/config untouched.
- **Email**: Google Workspace SMTP (nodemailer, smtp.gmail.com:465).
  epicpickem.com is a *user alias domain* on the Drip Workspace org; sends as
  no_reply@epicpickem.com (send-as alias). SPF/DKIM/DMARC live at Squarespace
  DNS. DMARC is `p=none` — tighten to quarantine after a few clean weeks.
- **DNS**: Squarespace. A/AAAA at apex → Fly IPs, www CNAME → epicpickem.fly.dev,
  acme-challenge CNAMEs for certs, Google TXT/MX/DKIM via Entri preset.
- **Fly API access**: account-wide tokens are SSO-blocked. Pattern that works:
  CLI-session handshake (POST api.fly.io/api/v1/cli_sessions → owner clicks
  auth_url → poll for access_token; org access on those tokens expires FAST),
  then mint app-scoped deploy tokens via GraphQL createLimitedAccessToken
  (profileParams {app_id: "<app-name-string>"}). Deploy tokens can also
  allocate IPs / add certs for their app.

## GitHub secrets/vars inventory (names only)

Secrets: FLY_API_TOKEN (staging deploys), PROD_FLY_API_TOKEN,
STAGING_/PROD_ DATABASE_URL + DIRECT_URL + SESSION_SECRET + CRON_SECRET,
PROD_SUPABASE_URL, PROD_SUPABASE_ANON_KEY, optional STAGING_SUPABASE_*,
GIPHY_API_KEY, SMTP_USER, SMTP_PASS, EMAIL_FROM, STAGING_APP_URL (also
accepted as a secret). Vars: STAGING_APP_URL, APP_URL (unset = epicpickem.com).

## Scheduled workflows

- `sync-results.yml` — every 15 min: /api/cron/sync + /api/cron/reminders on
  prod and staging. NOTE: `secrets.*` is ILLEGAL in step `if:` — mirror into
  job env (that bug once invalidated the file and silently killed the cron).
- `espn-canary.yml` — daily 12:00 UTC, scripts/espn-canary.mjs probes ESPN
  team lists + 7-day scoreboards, off-season tolerant. Red run = feed broke.
- Feed health: cron writes SyncRun rows (pruned 7d); HQ page shows the tile.

## Feature map (all verified E2E)

Leagues: 4 formats (classic/confidence/survivor/spread), blind picks,
tiebreakers, money tracker (NO payment processing — deliberate), chat
(GIPHY GIFs, reactions, commissioner pins), league notes, invites (link,
QR-able code, email), reminders (cron + nudges), team branding, recaps +
reactions, streak/movement UI. Slate builder: drag-and-drop, by
week/day/team, 🎁 packs (city + themes + 🏅 Top 25 CFB — empty until the
preseason AP poll ~mid-Aug), 🗓️ cross-sport week window (anchor NFL/CFB
week sweeps all sports, batched 4-at-a-time — ESPN 503s on a 13-league
burst). Fantasy: Sleeper + ESPN H2H matchup pick'em. Event nights: guest
quick-join (JWT cookie), venue geofence (haversine + 75m grace, deterrent
not proof), public /tv/<code> leaderboard with join QR, account claim
(email/password or Google; adoptGuestAccounts merges). Venue tier v2:
Venue model groups recurring nights (each night = a League via
League.venueId, fresh invite code). TWO entry paths: venue-first
(/venues/new — name/emoji/sport/format defaults + optional geofence, then
start nights from the console; "+ New venue" on dashboard, cross-link on
/leagues/new) or promoted from league admin ("make this a recurring
venue", which captures the league's sport/format as the venue defaults); host console /venues/[id] (start tonight's game
clones last night's settings + venue geofence, night history with per-night
winners, settings); cross-night "bar regulars" board (src/lib/venue.ts,
aggregates by USER so claimed guests keep records; night wins → points;
attendance tiers 3🍻/6🔥/10👑); permanent TV board /tv/venue/<venueCode>
(auto-features newest night + join QR + regulars wall — the bar bookmarks
ONE url). /tv/* routes render CHROME-FREE (no app header/footer/width cap
— root layout branches on x-pathname, stamped by src/middleware.ts),
ALWAYS DARK regardless of the theme cookie (projection surfaces), get
a floating ⛶ fullscreen toggle, and zoom 1.3×/1.8× at ≥1600/2400px
(.tv-zoom in globals.css) so boards read from across a bar. The featured
slate's games run as a bottom TICKER (components/TvTicker.tsx — pure CSS
loop, two identical halves translate -50%; auto-refresh patches scores
without restarting the scroll; honors prefers-reduced-motion). Venue
branding: editable emoji icon + optional uploaded logo (PNG/JPEG/WebP
≤512KB, bytes in Venue.logo BYTEA — globally OMITTED in lib/db.ts so
queries stay light; served by /api/venues/[id]/logo with immutable cache,
?v=logoUpdatedAt busts; components/VenueMark.tsx picks logo-else-emoji on
console/TV/dashboard). Player: share cards
(/api/leagues/[id]/card/[slateId], Web Share API), trophy case. HQ
(super admin, mlporritt@gmail.com via SUPER_ADMIN_EMAILS): stats, feed
health, curated pick packs, league/user admin, global sync. Brand:
trophy-check mark (public/icon.svg is the master), OG cards (static +
dynamic invite unfurls). Themes: light (DEFAULT) / dark / match-device,
cycled from the header toggle, persisted in the ep_theme cookie
(per-device, works for guests, no flash — the root layout stamps
<html data-theme>). Light mode works by overriding the --color-* vars
Tailwind 4 utilities compile to (globals.css — the two override blocks
must stay identical); avoid hover:text-white on neutral backgrounds, use
hover:text-slate-100 (theme-safe) instead.

## Dev/test recipes (cloud container)

- Local Postgres dies between turns:
  `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/epicdata -l /var/lib/postgresql/epicdata/log.txt -o '-p 5432 -k /tmp' start"`
- Kill dev server without killing your shell: `pkill -9 -f "next-serve[r]"`
- Mint a session cookie for any user (curl/Playwright testing; .env
  SESSION_SECRET is quoted — strip quotes):
  `node -e "const {SignJWT}=require('jose');const m=require('fs').readFileSync('.env','utf8').match(/SESSION_SECRET=\"?([^\"\n]*)\"?/);new SignJWT({sub:'<userId>'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(m[1])).then(console.log)"`
- Playwright: `playwright-core` only (no @playwright/test), executablePath
  `/opt/pw-browsers/chromium`, run scripts FROM the repo dir (module
  resolution). Geolocation tests: newContext({geolocation, permissions:["geolocation"]}).
  `text=` selectors are case-insensitive substrings — beware collisions.
- Container network: fly.dev sites, smtp, api.machines.dev BLOCKED;
  api.fly.io + ESPN reachable (node fetch DNS is flaky — curl with
  `--cacert /root/.ccr/ca-bundle.crt` is steadier). GitHub API only via MCP
  tools. Can't read GH secrets — verify via workflow runs/logs.
- Satori/ImageResponse rules: multi-child divs need explicit display:flex
  (merge text into ONE template literal), emoji = tofu (avoid or fetch
  twemoji), inline <svg> works fine.
- Shell gotcha: bcrypt hashes and other `$`-laden strings get eaten inside
  double-quoted `su -c "psql ..."` — write SQL to a file and `psql -f`.
- `UID` is a readonly bash variable — name it USERID.

## Known gaps / backlog

- Venue tier v2 follow-ups: no venue transfer UI yet (delete exists — nights
  survive as ordinary leagues, League.venueId SET NULL); venue geofence
  edits apply to FUTURE nights only (running night edits live in its league
  admin — documented in UI); unclaimed guests appear once per night on the
  regulars wall (claiming merges them — by design, nudge copy exists).
- Drip-branded auth emails: FIXED and LIVE in prod (deploy run #9 verified:
  PROD_SUPABASE_SECRET_KEY staged as SUPABASE_SECRET_KEY). Still to verify
  by hand: signup + forgot-password emails arrive from
  no_reply@epicpickem.com with Epic branding and their links sign in.
  Optional: STAGING_SUPABASE_SECRET_KEY for staging (mint a separate key so
  either can be revoked alone; shared project). Caveat from Supabase docs:
  sb_secret keys had auth.admin issues only on SELF-HOSTED/local stacks —
  hosted (ours) is fine; if generateLink ever 401s, the legacy service_role
  JWT still works via the same env var.
- Supabase Realtime chat (polling MVP today), H2H compare, season champion
  card, brackets, Yahoo import, Expo native app, PostHog analytics.
- Picks aren't location-rechecked after joining a geofenced league (join
  gate only — documented tradeoff).
- Stale branch `claude/pickem-league-platform-49oob5` still exists with an
  old committed .env — delete it; revoke any leftover Fly session tokens.
- Top 25 pack: confirm it fills once the preseason AP poll lands (~mid-Aug).
