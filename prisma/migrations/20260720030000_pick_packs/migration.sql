CREATE TABLE "PickPack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎁',
    "description" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PickPack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PickPackGame" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "externalId" TEXT,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "winner" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "spread" DOUBLE PRECISION,
    CONSTRAINT "PickPackGame_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PickPackGame" ADD CONSTRAINT "PickPackGame_packId_fkey" FOREIGN KEY ("packId") REFERENCES "PickPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickPack" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PickPackGame" ENABLE ROW LEVEL SECURITY;
