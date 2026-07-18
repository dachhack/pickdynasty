-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "awayScore" INTEGER,
ADD COLUMN     "homeScore" INTEGER,
ADD COLUMN     "spread" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'classic';

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "confidence" INTEGER;

-- CreateTable
CREATE TABLE "TiebreakerGuess" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "TiebreakerGuess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TiebreakerGuess_slateId_membershipId_key" ON "TiebreakerGuess"("slateId", "membershipId");

-- AddForeignKey
ALTER TABLE "TiebreakerGuess" ADD CONSTRAINT "TiebreakerGuess_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TiebreakerGuess" ADD CONSTRAINT "TiebreakerGuess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
