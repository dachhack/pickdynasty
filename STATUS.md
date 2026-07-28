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

2026-07-24 — Feed observability shipped: SyncRun health rows + fail-loud cron sync (502 when every league errors), daily ESPN canary workflow probing API shape, HQ feed-health tile. Owner set STAGING_APP_URL + GIPHY/SMTP keys; staging cron leg now active.

## Current blockers

- Production launch is owner-gated: Supabase prod project, PROD_* secrets, Fly app `epicpickem` + app-scoped token (needs a CLI-session auth handshake), DNS/certs for epicpickem.com.

## Next 3 tasks

1. Confirm the 15-min sync cron goes green with the staging leg executing, and the canary's first scheduled run passes.
2. Run the production launch checklist in DEPLOYMENT.md (fresh prod secrets — staging ones appeared in chat).
3. Venue tier v2: recurring event nights + cross-night "bar regulars" leaderboard.
