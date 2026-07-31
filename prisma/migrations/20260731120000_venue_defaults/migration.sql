-- Venue-first flow: venues carry sport/format defaults for their nights.
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "Venue" ADD COLUMN "sport" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Venue" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'classic';
