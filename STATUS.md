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

2026-07-30 — Selectable themes shipped: dark (default) / light / match-device, cycled from a header toggle, per-device via cookie, no flash on load. Light mode remaps the Tailwind color variables so the whole app flips without per-page changes; verified by screenshot across dashboard, venue console, and TV board. On main, not yet in the prod deploy below. Earlier — DEPLOYED TO PRODUCTION (run #9, verified green: venue migration applied, SUPABASE_SECRET_KEY staged, machines healthy). Live now: venue tier v2, forgot-password, Epic-branded auth emails (minted via admin generateLink, sent through Epic's own SMTP with Epic templates; new /auth/confirm route verifies + signs in). Also — forgot-password flow shipped (both auth drivers: Supabase recovery email → /auth/callback → /reset-password; local driver emails a single-use 30-min signed token; "Forgot password?" link on login). Verified E2E locally: bad/expired/reused tokens rejected, reset signs you in, old password dead. Earlier same day — Venue tier v2 shipped: recurring event nights (Venue model; each night is its own league; one-tap "start tonight's game" clones settings + geofence), cross-night "bar regulars" leaderboard with attendance tiers (🍻 Regular / 🔥 Diehard / 👑 Legend), and a permanent per-venue TV board (/tv/venue/<code>) the bar bookmarks once. Includes one hand-written migration (Venue table + League.venueId). Verified E2E locally (promote league → venue, start next night, regulars aggregation, TV board). On main with the earlier feature batch, awaiting one Deploy production run.

## Current blockers

- None. Owner is deploying the feature batch to production.

## Next 3 tasks

1. Post-deploy spot check from a phone: signup + forgot-password emails arrive Epic-branded from no_reply@epicpickem.com and their links sign in; promote a league to a venue and run a night for real; confirm the Top 25 pack fills once the preseason AP poll lands (~mid-August).
2. Tighten DMARC to quarantine after a few clean weeks of Epic-branded auth email sends.
3. Venue polish: venue delete/transfer UI, and consider surfacing the regulars wall inside each night's league page.
