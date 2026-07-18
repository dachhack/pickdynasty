# Deploying Epic Pick'em

## Why not GitHub Pages?

GitHub Pages only serves **static files**. Epic Pick'em is a server-rendered
Next.js app — auth sessions, a database, server actions, and API/cron routes —
so it needs a Node.js host. The equivalent (and free) QA story is **Vercel
preview deployments**: every push to a branch gets its own live URL
automatically, which is strictly better than a single Pages QA site.

## Recommended setup: Vercel + Neon Postgres

```
GitHub repo
 ├─ push to any branch  ──▶  Vercel Preview  (QA URL per push)  ─▶ Neon branch DB
 └─ merge to main       ──▶  Vercel Production (epicpickem.com) ─▶ Neon main DB
```

### One-time steps

1. **Vercel**: import the GitHub repo (framework auto-detected). Every branch
   push now gets a preview URL; `main` deploys to production.
2. **Neon** (or Vercel Postgres): create a project. Copy the pooled connection
   string. Neon's *database branching* pairs perfectly with previews — QA
   deploys can point at a branch of the prod database with realistic data.
3. **Switch Prisma to Postgres**: in `prisma/schema.prisma` change
   `provider = "sqlite"` → `provider = "postgresql"`, delete
   `prisma/migrations` (they're SQLite-flavored), and run
   `npx prisma migrate dev --name init` once against a Postgres URL to create
   a fresh Postgres baseline. Commit the new migrations.
4. **Vercel env vars** (Production + Preview scopes separately):
   - `DATABASE_URL` — prod DB for Production, QA/branch DB for Preview
   - `SESSION_SECRET` — `openssl rand -hex 32`, different per environment
   - `CRON_SECRET` — protects `/api/cron/sync`; Vercel Cron sends it
     automatically as a Bearer token when set
5. **Build command**: `npx prisma migrate deploy && next build` so schema
   changes apply on every deploy.
6. **Domain**: add `epicpickem.com` (and `www`) in Vercel → Domains, set the
   DNS records it prints at your registrar. Optionally add `qa.epicpickem.com`
   as a fixed alias for a QA branch.

### What's already in the repo

- `.github/workflows/ci.yml` — lint + build gate on every push/PR (this is
  the "QA" gate that runs in GitHub itself)
- `vercel.json` — cron schedule hitting `/api/cron/sync` every 15 minutes so
  game results and standings update without anyone pressing "Sync"
  (hobby-plan crons are limited to daily; paid plans honor the 15-min schedule)
- `/api/cron/sync` — the endpoint itself, `CRON_SECRET`-guarded

## Data plumbing summary

| Piece | Dev (today) | Production |
| --- | --- | --- |
| Database | SQLite file (`prisma/dev.db`) | Postgres (Neon/Vercel) |
| Schema management | `prisma migrate dev` | `prisma migrate deploy` on build |
| Sessions | JWT cookie, `SESSION_SECRET` from `.env` | same, secret from Vercel env |
| Sports data | ESPN public API (no key) | same — no credentials needed |
| Fantasy data | Sleeper public API / ESPN fantasy | same; private ESPN leagues store espn_s2/SWID per league |
| Result updates | manual "Sync results" button | Vercel Cron → `/api/cron/sync` |
| File storage | none needed | none needed |

No payment processing, no email service, and no API keys are required for the
current feature set. First future needs: an email provider (Resend/Postmark)
for pick reminders, and OAuth apps if Yahoo Fantasy or social login are added.
