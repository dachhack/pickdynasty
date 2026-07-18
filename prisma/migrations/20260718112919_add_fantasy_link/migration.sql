-- CreateTable
CREATE TABLE "FantasyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerLeagueId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "espnS2" TEXT,
    "swid" TEXT,
    CONSTRAINT "FantasyLink_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FantasyLink_leagueId_key" ON "FantasyLink"("leagueId");
