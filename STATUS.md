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

2026-07-30 — Venue tier v2 shipped: recurring event nights (Venue model; each night is its own league; one-tap "start tonight's game" clones settings + geofence), cross-night "bar regulars" leaderboard with attendance tiers (🍻 Regular / 🔥 Diehard / 👑 Legend), and a permanent per-venue TV board (/tv/venue/<code>) the bar bookmarks once. Includes one hand-written migration (Venue table + League.venueId). Verified E2E locally (promote league → venue, start next night, regulars aggregation, TV board). On main with the earlier feature batch, awaiting one Deploy production run.

## Current blockers

- None. Owner is deploying the feature batch to production.

## Next 3 tasks

1. Post-deploy spot check: promote a league to a venue and run a night for real; share a result card from a phone; confirm the Top 25 pack fills once the preseason AP poll lands (~mid-August).
2. Supabase project polish: custom SMTP for auth emails + brand-neutral templates; tighten DMARC to quarantine after a few clean weeks.
3. Venue polish: venue delete/transfer UI, and consider surfacing the regulars wall inside each night's league page.
