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

2026-07-30 — Feature burst on top of the live launch: trophy-check brand (logo, favicons, PWA icons, header), OG share cards (static site card + dynamic league-invite unfurls), Top 25 CFB rule pack (fills when the AP poll drops mid-August), cross-sport week window in the slate builder, player share cards + trophy case, commissioner chat pins + league notes. All on main, awaiting one Deploy production run.

## Current blockers

- None. Owner is deploying the feature batch to production.

## Next 3 tasks

1. Post-deploy spot check: share a result card from a phone, pin a chat message, confirm the Top 25 pack fills once the preseason AP poll lands (~mid-August).
2. Supabase project polish: custom SMTP for auth emails + brand-neutral templates; tighten DMARC to quarantine after a few clean weeks.
3. Venue tier v2: recurring event nights + cross-night "bar regulars" leaderboard.
