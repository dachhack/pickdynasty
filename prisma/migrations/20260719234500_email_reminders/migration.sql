ALTER TABLE "User" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderLog_slateId_membershipId_key" ON "ReminderLog"("slateId", "membershipId");

ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderLog" ENABLE ROW LEVEL SECURITY;
