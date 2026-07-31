-- Venue nights can be planned ahead: League.eventAt is the scheduled date
-- (null = legacy/non-venue league, readers fall back to createdAt).
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "League" ADD COLUMN "eventAt" TIMESTAMP(3);
