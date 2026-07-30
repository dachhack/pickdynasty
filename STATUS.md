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

2026-07-30 — Launch completed end-to-end: epicpickem.com DNS + certs live, prod cron green on both targets, Supabase auth active in prod (fixed Dockerfile dropping NEXT_PUBLIC_* between stages), Google sign-in shipped, branded email via Google Workspace (epicpickem.com user-alias domain on the Drip org; SPF/DKIM/DMARC set at Squarespace; sends as no_reply@epicpickem.com).

## Current blockers

- None for core operation. Verify in-app: Google button on /signup works (needs Google provider enabled in the shared Supabase project), and a test invite email lands.

## Next 3 tasks

1. Owner verification pass: Google sign-in round-trip, invite email delivery, HQ feed-health tile on prod.
2. Supabase project polish: custom SMTP for auth emails + brand-neutral templates (currently Drip-branded for both products); tighten DMARC to quarantine after a few clean weeks.
3. Venue tier v2: recurring event nights + cross-night "bar regulars" leaderboard.
