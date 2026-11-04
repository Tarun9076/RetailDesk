-- A new login role for the 18 salesmen.
ALTER TYPE "Role" ADD VALUE 'SALESMAN';

-- Salesmen log in with their phone number (retailers keep using Retailer.phone).
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Which salesman visits which shop. Removing a salesman leaves the shop unassigned.
ALTER TABLE "Retailer" ADD COLUMN "salesmanId" TEXT;
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Retailer_salesmanId_idx" ON "Retailer"("salesmanId");

-- Who entered an order for a shop, and when it was really taken if the phone was offline.
ALTER TABLE "Order" ADD COLUMN "placedById" TEXT;
ALTER TABLE "Order" ADD COLUMN "capturedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD CONSTRAINT "Order_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_placedById_createdAt_idx" ON "Order"("placedById", "createdAt");
