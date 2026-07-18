# ⚡ Epic Pick'em

Pick'em leagues with friends, for **every** sport — NFL, college football, NBA, college
basketball, March Madness, MLB, the College World Series, the Little League World Series,
NHL, tennis, MLS, and anything else you can score.

## Features

- **Leagues for any sport** — create a league, pick the sport and season, set a buy-in.
- **Four formats** — classic pick'em (1 pt per correct pick), confidence points (rank picks
  1–N, correct picks score their rank), survivor (one team per slate, never reuse a team,
  lose and you're out), and against-the-spread (lines imported from ESPN odds).
- **Tiebreakers** — predict the total score of each slate's last game; closest wins ties.
- **Live scores & recaps** — in-progress and final scores sync from ESPN onto the picks
  page, and every finished slate gets an auto-generated recap (best performer, biggest
  upset, tiebreaker result — or survivor eliminations).
- **Invites** — every league gets a short invite code and shareable join link; commissioners
  can regenerate it at any time.
- **Blind picks** — everyone's picks stay hidden until each game locks (at kickoff, or at a
  slate-wide deadline). Optional commissioner override for dispute resolution.
- **Slates & results** — commissioners build "slates" (an NFL week, a tournament round, a
  day of games), add matchups, and enter results; standings update automatically.
- **Standings** — 1 point per correct pick, live leaderboard with win %.
- **Team branding** — every player names their team and picks a color + emoji.
- **Money tracker** — buy-ins, side pots, payouts, and adjustments in a ledger with
  settled/unsettled status. *Epic Pick'em tracks money; it never moves it.* No payment
  processing — settle up in cash or Venmo and mark it settled.
- **Fantasy league pick'em** — link a Sleeper or ESPN fantasy league and import its weekly
  head-to-head matchups as pick'em games: members pick which fantasy teams win. Public
  ESPN leagues work with just the league ID; private ones need the espn_s2/SWID cookies.
  Results sync automatically once a week is final.
- **Admin area** — member management (promote/demote commissioners, remove players),
  league settings, invite management.
- **Installable on mobile** — the site is a PWA (`manifest.json`); "Add to Home Screen"
  gives an app-like experience on iOS/Android. A native app (Expo/React Native) can reuse
  the same backend later.

## Stack

Shares one provider stack with [Drip League FF](https://github.com/dachhack/ffgame)
(see `DEPLOYMENT.md`): **Supabase** (Postgres + Auth, shared accounts across both
products), **Fly.io** hosting, **GitHub Actions** for CI and scheduled result sync.

- [Next.js 16](https://nextjs.org) (App Router, React Server Components, Server Actions)
- TypeScript + Tailwind CSS 4
- [Prisma 6](https://prisma.io) ORM on Postgres
- Auth: Supabase Auth in production; a self-contained JWT driver takes over
  automatically in dev/CI when Supabase env vars are absent

## Getting started

```bash
npm install
cp .env.example .env       # point DATABASE_URL/DIRECT_URL at any Postgres
npx prisma migrate deploy
npm run dev                # http://localhost:3000
```

Sign up, create a league, and share the invite link from **Admin → Invite players**.

## Project layout

```
prisma/schema.prisma      # data model: User, League, Membership, Slate, Game, Pick, MoneyEntry
src/lib/                  # db client, auth/session, league helpers (standings, locking)
src/actions/              # server actions: auth, leagues, picks, admin, money
src/app/                  # routes
  dashboard/              # my leagues + join by code
  leagues/new/            # create league
  join/[code]/            # invite landing
  leagues/[id]/           # standings (default tab)
    picks/                # slate list → pick entry with blind-pick logic
    money/                # pot summary, per-player balances, ledger
    team/                 # team name / color / emoji
    admin/                # invites, settings, members
    admin/slates/         # slates, games, results entry
```

## Roadmap

- Automatic schedules & scores via a sports data API (ESPN public endpoints or
  SportsDataIO) instead of manual game entry
- More pool formats: confidence points, survivor, spread (ATS), brackets for
  March Madness
- Email/push reminders before pick deadlines
- Native mobile app with Expo (React Native) sharing this backend
- Postgres + hosted deploy (Vercel/Fly), OAuth sign-in
