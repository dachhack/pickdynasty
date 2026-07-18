# ⚡ Epic Pick'em

Pick'em leagues with friends, for **every** sport — NFL, college football, NBA, college
basketball, March Madness, MLB, the College World Series, the Little League World Series,
NHL, tennis, MLS, and anything else you can score.

## Features

- **Leagues for any sport** — create a league, pick the sport and season, set a buy-in.
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
- **Admin area** — member management (promote/demote commissioners, remove players),
  league settings, invite management.
- **Installable on mobile** — the site is a PWA (`manifest.json`); "Add to Home Screen"
  gives an app-like experience on iOS/Android. A native app (Expo/React Native) can reuse
  the same backend later.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React Server Components, Server Actions)
- TypeScript + Tailwind CSS 4
- [Prisma 6](https://prisma.io) ORM — SQLite in development, switch the datasource
  provider to `postgresql` for production
- Cookie-based sessions (JWT via `jose`), passwords hashed with bcrypt

## Getting started

```bash
npm install
cp .env.example .env       # then set a real SESSION_SECRET
npx prisma migrate dev     # creates prisma/dev.db
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
