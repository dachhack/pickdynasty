-- Venue branding: optional uploaded logo replacing the emoji mark.
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "Venue" ADD COLUMN "logo" BYTEA;
ALTER TABLE "Venue" ADD COLUMN "logoType" TEXT;
ALTER TABLE "Venue" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
