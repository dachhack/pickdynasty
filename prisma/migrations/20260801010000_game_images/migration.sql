-- ESPN CDN art: team logos on match rows, player headshots on prop rows.
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "Game" ADD COLUMN "homeLogo" TEXT;
ALTER TABLE "Game" ADD COLUMN "awayLogo" TEXT;
ALTER TABLE "Game" ADD COLUMN "propImage" TEXT;
