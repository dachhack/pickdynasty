-- Bar/event-night mode: guest quick-join accounts, optional venue geofence,
-- and the public TV leaderboard toggle.
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "claimEmail" TEXT;
CREATE INDEX "User_claimEmail_idx" ON "User"("claimEmail");

ALTER TABLE "League" ADD COLUMN "allowGuests" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "League" ADD COLUMN "requireLocation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "League" ADD COLUMN "venueLat" DOUBLE PRECISION;
ALTER TABLE "League" ADD COLUMN "venueLng" DOUBLE PRECISION;
ALTER TABLE "League" ADD COLUMN "venueRadiusM" INTEGER NOT NULL DEFAULT 150;
