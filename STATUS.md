# STATUS

> Orchestrator-facing status. Keep this short and current — `meta`'s
> `/standup` reads it. In-repo WIP details belong in HANDOFF.md.
> Goal / Phase / Cadence are mirrored into `meta/projects.md`.

## Goal

Epic Pick'em (epicpickem.com): pick'em leagues with friends across every sport — four formats, fantasy-matchup pick'em, mixed-sport slates, curated pick packs, and bar/venue event nights. Money is tracked, never processed. Shares the Supabase/Fly/Google Workspace stack with Drip League FF for unified accounts.

## Current phase

Feature-complete staging (epicpickem-staging.fly.dev, auto-deploys from main); production launch checklist in DEPLOYMENT.md not yet run.

## Cadence

Bursts when owner has time — recent pace was daily; assume weekly minimum until production launch. (Inferred from history, not confirmed.)

## Last worked

2026-07-20 — Shipped bar event nights (guest quick-join, venue geofence, public TV leaderboard, account claim); fixed the invalid sync-results workflow that was failing every push and silently disabling the results cron; made staging auto-deploy on push to main.

## Current blockers

- Production launch is owner-gated: Supabase prod project, PROD_* secrets, Fly app `epicpickem` + app-scoped token (needs a CLI-session auth handshake), DNS/certs for epicpickem.com.
- Repo variable `STAGING_APP_URL` unset, so the 15-min results-sync cron still skips staging.
- Optional keys unset: GIPHY_API_KEY (chat GIFs), SMTP_USER/SMTP_PASS (invite/reminder email).

## Next 3 tasks

1. Set `STAGING_APP_URL` repo variable and confirm the scheduled results sync hits staging.
2. Run the production launch checklist in DEPLOYMENT.md (fresh prod secrets — staging ones appeared in chat).
3. Feed observability: daily ESPN canary workflow, fail-loud sync step, HQ feed-health tile.
