-- An audit trail for desk staff accounts.
CREATE TABLE "StaffEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffEvent_userId_createdAt_idx" ON "StaffEvent"("userId", "createdAt");
CREATE INDEX "StaffEvent_createdAt_idx" ON "StaffEvent"("createdAt");
