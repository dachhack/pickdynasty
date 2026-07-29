# STATUS

> Orchestrator-facing status. Keep this short and current — `meta`'s
> `/standup` reads it. In-repo WIP details belong in HANDOFF.md.
> Goal / Phase / Cadence are mirrored into `meta/projects.md`.

## Goal

Epic Pick'em (epicpickem.com): pick'em leagues with friends across every sport — four formats, fantasy-matchup pick'em, mixed-sport slates, curated pick packs, and bar/venue event nights. Money is tracked, never processed. Shares the Supabase/Fly/Google Workspace stack with Drip League FF for unified accounts.

## Current phase

PRODUCTION IS LIVE at epicpickem.fly.dev (Fly app `epicpickem`, dedicated `epicpickem` schema in the shared Drip Supabase project, shared accounts working). Awaiting DNS cutover to epicpickem.com (records issued, owner adding at Squarespace).

## Cadence

Bursts when owner has time — recent pace was daily; assume weekly minimum until production launch. (Inferred from history, not confirmed.)

## Last worked

2026-07-29 — PRODUCTION LAUNCHED: deploy green on Fly app `epicpickem`, dedicated DB schema migrated in shared Drip Supabase project, IPs + certs allocated, DNS records handed to owner (Squarespace, pending). Smoke test passed with shared Drip login. Added Google sign-in (OAuth callback route, guest-claim-via-Google, buttons on login/signup/claim).

## Current blockers

- DNS records for epicpickem.com pending at Squarespace (A, AAAA, www CNAME, 2× acme-challenge CNAMEs) — certs auto-issue once they propagate.
- Google provider needs enabling in the shared Supabase project (or confirming Drip already enabled it) before the Google button works in prod.

## Next 3 tasks

1. Verify epicpickem.com DNS + certs after owner adds records; flip APP_URL variable to https://epicpickem.com; re-run Deploy production to ship Google sign-in.
2. Confirm first prod cron ticks and ESPN canary run are green; watch HQ feed-health tile on prod.
3. Venue tier v2: recurring event nights + cross-night "bar regulars" leaderboard.
