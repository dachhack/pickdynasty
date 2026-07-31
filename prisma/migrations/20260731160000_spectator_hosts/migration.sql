-- Hosting without playing: spectator memberships have admin rights but no
-- board presence (venue-night commissioners start this way).
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "Membership" ADD COLUMN "spectator" BOOLEAN NOT NULL DEFAULT false;
