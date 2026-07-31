-- 🎯 Player props: over/under rows mixed into slates (Game.kind = 'prop').
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "Game" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'match';
ALTER TABLE "Game" ADD COLUMN "propLabel" TEXT;
ALTER TABLE "Game" ADD COLUMN "propPlayer" TEXT;
ALTER TABLE "Game" ADD COLUMN "propStat" TEXT;
ALTER TABLE "Game" ADD COLUMN "line" DOUBLE PRECISION;
ALTER TABLE "Game" ADD COLUMN "propActual" DOUBLE PRECISION;
