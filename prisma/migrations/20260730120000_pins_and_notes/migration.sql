-- Commissioner tools: pinned chat messages + league notes.

ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "League" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
