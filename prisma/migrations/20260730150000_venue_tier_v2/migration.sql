-- Venue tier v2: recurring event nights + cross-night "bar regulars" board.
-- A Venue groups many event-night Leagues (League.venueId) under one stable
-- public code for the bookmarkable TV board and saved geofence defaults.
-- Hand-written (see README note on RLS + shadow DB): apply with `prisma migrate deploy`.

CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🍺',
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requireLocation" BOOLEAN NOT NULL DEFAULT false,
    "venueLat" DOUBLE PRECISION,
    "venueLng" DOUBLE PRECISION,
    "venueRadiusM" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Venue_code_key" ON "Venue"("code");

ALTER TABLE "Venue" ADD CONSTRAINT "Venue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "League" ADD COLUMN "venueId" TEXT;

CREATE INDEX "League_venueId_idx" ON "League"("venueId");

ALTER TABLE "League" ADD CONSTRAINT "League_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;
