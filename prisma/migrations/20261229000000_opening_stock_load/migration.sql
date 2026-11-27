-- Opening stock of a store at go-live (owner, 27 Nov 2026): uploaded from the physical count, approved by a second person.
-- Two new tables only; nothing existing changes.
CREATE TABLE "OpeningStockLoad" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "loadNumber" TEXT NOT NULL,
    "storeId" UUID NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL,
    "countSheetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "remarks" TEXT,
    "totalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    CONSTRAINT "OpeningStockLoad_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OpeningStockLine" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "loadId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "batchId" UUID,
    CONSTRAINT "OpeningStockLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OpeningStockLoad_loadNumber_key" ON "OpeningStockLoad"("loadNumber");
CREATE INDEX "OpeningStockLoad_storeId_status_idx" ON "OpeningStockLoad"("storeId", "status");
CREATE INDEX "OpeningStockLoad_status_idx" ON "OpeningStockLoad"("status");
CREATE UNIQUE INDEX "OpeningStockLine_loadId_itemId_key" ON "OpeningStockLine"("loadId", "itemId");
CREATE INDEX "OpeningStockLine_itemId_idx" ON "OpeningStockLine"("itemId");
ALTER TABLE "OpeningStockLoad" ADD CONSTRAINT "OpeningStockLoad_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpeningStockLine" ADD CONSTRAINT "OpeningStockLine_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "OpeningStockLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpeningStockLine" ADD CONSTRAINT "OpeningStockLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
