# 🏆 PickDynasty

Set up, track, administer, and compete in pick'em leagues with friends — for **every sport**:
NFL, College Football, NBA, College Basketball, March Madness, MLB, College World Series,
Little League World Series, NHL, Tennis, MLS, international soccer, golf, and anything else.

Built as a mobile-first web app that installs to your phone's home screen (PWA), so one codebase
covers the website and the mobile app.

## Features

- **Leagues for any sport** — pick a sport, name the season, and go. Straight-up or against-the-spread scoring, with per-game point values (great for confidence pools and playoff rounds).
- **Blind pick tracking** — with blind picks on, nobody can see anyone else's picks until each game locks. Before lock you only see *how many* players have picked in; at lock everything is revealed.
- **Admin area** — commissioners (and promoted co-admins) invite players, build the schedule (weeks/rounds/slates named per sport), enter final scores and results, manage members, and edit league settings.
- **Invites** — a shareable league code + join link, plus one-off personal invite codes you can revoke.
- **Money tracker (not a payment system)** — record buy-ins, payments received, payouts, and adjustments. Everyone sees the pot total and who's settled up; the app never moves money.
- **Team identity** — every player names their team and picks a color, emblem, and motto that show up across standings and picks.
- **Live standings** — automatic scoring the moment an admin marks a result final, with correct/wrong/push breakdowns.

## Getting started

```bash
npm install
npm run db:push   # creates prisma/dev.db (SQLite)
npm run dev       # http://localhost:3000
```

Create an account, click **+ New league**, then use the **Admin** tab to add a week and its games,
and share your invite code with friends.

## Tech stack

- [Next.js 14](https://nextjs.org) (App Router, server actions) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://prisma.io) with SQLite (swap `provider` to `postgresql` for production)
- Cookie-based sessions signed with HMAC (`SESSION_SECRET`), scrypt password hashing — no external auth service
- PWA manifest for install-to-home-screen on iOS and Android

## Production notes

- Set a strong `SESSION_SECRET` and point `DATABASE_URL` at Postgres/MySQL.
- `npm run build` runs `prisma generate`, `prisma db push`, then `next build`.
- The money ledger is intentionally tracker-only; settle up via cash/Venmo/etc.
