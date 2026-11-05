-- Shops can be switched off.
ALTER TABLE "Retailer" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Desk staff: temporary passwords and revoking old logins.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);

-- Audit trail for shops.
CREATE TABLE "ShopEvent" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShopEvent_retailerId_createdAt_idx" ON "ShopEvent"("retailerId", "createdAt");
ALTER TABLE "ShopEvent" ADD CONSTRAINT "ShopEvent_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Amounts shops owe, imported from Tally (previewed, then applied).
CREATE TABLE "BalanceImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "byName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "BalanceImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BalanceImport_createdAt_idx" ON "BalanceImport"("createdAt");

-- Ledger and unit names used in the Tally file.
CREATE TABLE "TallySetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TallySetting_pkey" PRIMARY KEY ("key")
);

-- Server errors, grouped.
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "route" TEXT,
    "method" TEXT,
    "digest" TEXT,
    "detail" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertedAt" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ErrorLog_fingerprint_key" ON "ErrorLog"("fingerprint");
CREATE INDEX "ErrorLog_lastSeenAt_idx" ON "ErrorLog"("lastSeenAt");
