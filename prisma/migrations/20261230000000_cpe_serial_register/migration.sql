-- CPE serials from the SLT CPE Locator, phase 1 (owner, 28 Nov 2026; docs/plans/cpe-serial-locator.md).
-- Additive only: new nullable columns on InventoryItemSerial (issueCycle defaults to 1), two new tables, and an immutability trigger on the new event table.

-- AlterTable
ALTER TABLE "InventoryItemSerial" ADD COLUMN     "cpeType" TEXT,
ADD COLUMN     "issueCycle" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "opmcId" UUID,
ADD COLUMN     "receiptId" UUID,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "sltReference" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "CpeReceipt" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "receiptNumber" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "opmcId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "contractorId" UUID,
    "cpeType" TEXT NOT NULL,
    "model" TEXT,
    "sltReference" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "issueNumber" TEXT,
    "remarks" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpeSerialEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "serialId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "issueCycle" INTEGER NOT NULL,
    "opmcId" UUID,
    "storeId" UUID,
    "contractorId" UUID,
    "serviceOrderId" UUID,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "sltReference" TEXT,
    "reason" TEXT,
    "performedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousChecksum" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "CpeSerialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CpeReceipt_receiptNumber_key" ON "CpeReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "CpeReceipt_opmcId_createdAt_idx" ON "CpeReceipt"("opmcId", "createdAt");

-- CreateIndex
CREATE INDEX "CpeReceipt_contractorId_idx" ON "CpeReceipt"("contractorId");

-- CreateIndex
CREATE UNIQUE INDEX "CpeSerialEvent_checksum_key" ON "CpeSerialEvent"("checksum");

-- CreateIndex
CREATE INDEX "CpeSerialEvent_serialId_createdAt_idx" ON "CpeSerialEvent"("serialId", "createdAt");

-- CreateIndex
CREATE INDEX "CpeSerialEvent_serialNumber_idx" ON "CpeSerialEvent"("serialNumber");

-- CreateIndex
CREATE INDEX "CpeSerialEvent_opmcId_createdAt_idx" ON "CpeSerialEvent"("opmcId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryItemSerial_opmcId_status_idx" ON "InventoryItemSerial"("opmcId", "status");

-- CreateIndex
CREATE INDEX "InventoryItemSerial_receiptId_idx" ON "InventoryItemSerial"("receiptId");

-- AddForeignKey
ALTER TABLE "InventoryItemSerial" ADD CONSTRAINT "InventoryItemSerial_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemSerial" ADD CONSTRAINT "InventoryItemSerial_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CpeReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpeReceipt" ADD CONSTRAINT "CpeReceipt_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpeReceipt" ADD CONSTRAINT "CpeReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpeReceipt" ADD CONSTRAINT "CpeReceipt_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpeSerialEvent" ADD CONSTRAINT "CpeSerialEvent_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "InventoryItemSerial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CpeSerialEvent is an append-only history (AGENTS.md: immutable audit ledger), same opt-in as InventoryLedger for controlled maintenance:
--   SET LOCAL app.allow_cpe_event_mutation = 'on';
CREATE OR REPLACE FUNCTION fn_cpe_serial_event_immutable() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_cpe_event_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'CpeSerialEvent is immutable (% blocked)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cpe_serial_event_immutable ON "CpeSerialEvent";
CREATE TRIGGER trg_cpe_serial_event_immutable
BEFORE UPDATE OR DELETE ON "CpeSerialEvent"
FOR EACH ROW EXECUTE FUNCTION fn_cpe_serial_event_immutable();
