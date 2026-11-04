-- SLT-reported material per service order (extension / future API). Reference data only:
-- no stock movement, no ledger posting. Manual SODMaterialUsage is compared against it.
CREATE TABLE "SODSltReportedMaterial" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "serviceOrderId" UUID NOT NULL,
    "itemId" UUID,
    "rawCode" TEXT,
    "rawName" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "serialNumber" TEXT,
    "source" TEXT NOT NULL DEFAULT 'EXTENSION',
    "reportedBy" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SODSltReportedMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SODSltReportedMaterial_serviceOrderId_idx" ON "SODSltReportedMaterial"("serviceOrderId");
CREATE INDEX "SODSltReportedMaterial_itemId_idx" ON "SODSltReportedMaterial"("itemId");
CREATE INDEX "SODSltReportedMaterial_source_idx" ON "SODSltReportedMaterial"("source");

ALTER TABLE "SODSltReportedMaterial" ADD CONSTRAINT "SODSltReportedMaterial_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SODSltReportedMaterial" ADD CONSTRAINT "SODSltReportedMaterial_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
