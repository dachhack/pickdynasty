# Deploying Epic Pick'em

Epic Pick'em shares one provider stack with **Drip League FF** (`dachhack/ffgame`)
so the same accounts, database provider, hosting, and ops patterns serve both
products:

| Function | Provider | Notes |
| --- | --- | --- |
| Database | **Supabase Postgres** | Same project as Drip → same `auth.users`; Epic's tables live in the `public` schema alongside its own (or use a dedicated schema if preferred) |
| Auth | **Supabase Auth** | Shared accounts across Drip + Epic. Local JWT driver kicks in automatically when Supabase env vars are absent (dev/CI) |
| App hosting | **Fly.io** | `fly.toml` + `Dockerfile` in this repo, same pattern as Drip's pilot worker |
| Static hosting | GitHub Pages | Drip's site only — Epic is server-rendered and lives on Fly |
| Scheduled jobs | **GitHub Actions** | `.github/workflows/sync-results.yml` hits `/api/cron/sync` every 15 min |
| CI | GitHub Actions | `ci.yml`: lint + build against a Postgres service container |
| Analytics | PostHog | (not yet wired into Epic — add `posthog-js` with the same org as Drip) |

## First deploy

1. **Supabase**: use the existing Drip project (shared accounts) — or a fresh
   project if you'd rather keep the products isolated. From Project Settings →
   Database, copy both connection strings:
   - pooled (port 6543) → `DATABASE_URL` (append `?pgbouncer=true`)
   - direct (port 5432) → `DIRECT_URL`

   From Project Settings → API, copy the URL and anon key for
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Fly**:
   ```bash
   fly apps create epicpickem
   fly secrets set DATABASE_URL='...' DIRECT_URL='...' \
     SESSION_SECRET=$(openssl rand -hex 32) CRON_SECRET=$(openssl rand -hex 32)
   fly deploy \
     --build-arg NEXT_PUBLIC_SUPABASE_URL='https://<ref>.supabase.co' \
     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY='<anon key>'
   ```
   The image runs `prisma migrate deploy` on boot, so schema changes apply on
   every deploy.

3. **Domain**: `fly certs add epicpickem.com` (and `www.epicpickem.com`), then
   set the A/AAAA/CNAME records Fly prints at your registrar.

4. **GitHub repo settings**:
   - Secret `CRON_SECRET` — same value as the Fly secret
   - Variable `APP_URL` — `https://epicpickem.com` (defaults to that if unset)

## QA / staging — no local machine needed

**The browser-only path** (this is the GitHub-Pages-style workflow for a
server app): `.github/workflows/deploy-staging.yml` deploys to a Fly app from
the Actions tab. One-time setup is entirely in the browser — create a Supabase
project, grab a Fly API token, paste five secrets into GitHub repo settings,
then run the workflow. Full steps are in the workflow file's header comment.
The app comes up at `https://epicpickem-staging.fly.dev`.

Without the optional `STAGING_SUPABASE_URL`/`ANON_KEY` secrets, staging uses
the built-in email/password auth — fine for testing; add them later to switch
to shared Supabase accounts.

CLI alternative:

```bash
fly apps create epicpickem-staging
fly deploy --config fly.toml --app epicpickem-staging ...
```

CI (`ci.yml`) gates every push/PR with lint + build against a disposable
Postgres, so broken schema or type errors never reach a deploy.

## Local development

Auth falls back to the built-in JWT driver when Supabase env vars are unset —
no Supabase account needed to hack on the app. You do need a Postgres URL
(any of: Supabase free project, `supabase start` locally, or plain Postgres):

```bash
cp .env.example .env    # fill in DATABASE_URL + DIRECT_URL
npx prisma migrate deploy
npm run dev
```

## Data plumbing summary

- **Sports + fantasy data**: ESPN and Sleeper public APIs — no keys, no cost.
- **Result updates**: GitHub Actions → `/api/cron/sync` (CRON_SECRET-guarded).
- **No payment processing** (money is tracked, never moved), no email service
  yet, no file storage. First future needs: an email provider for pick
  reminders; Yahoo OAuth if Yahoo fantasy import is added.
