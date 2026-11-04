-- CreateTable: an audit trail for every change to products, prices, stock and schemes.
CREATE TABLE "CatalogueEvent" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogueEvent_skuId_createdAt_idx" ON "CatalogueEvent"("skuId", "createdAt");

-- AddForeignKey
ALTER TABLE "CatalogueEvent" ADD CONSTRAINT "CatalogueEvent_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;
