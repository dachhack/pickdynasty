-- Feed observability: per-tick sync health rows for the HQ feed-health tile.

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "leaguesChecked" INTEGER NOT NULL,
    "gamesUpdated" INTEGER NOT NULL,
    "upstreamFetches" INTEGER NOT NULL,
    "errors" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

ALTER TABLE "SyncRun" ENABLE ROW LEVEL SECURITY;
