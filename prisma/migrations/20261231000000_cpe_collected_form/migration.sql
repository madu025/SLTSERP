-- Collected CPE Handing Over Form (owner, 28 Nov 2026; docs/plans/cpe-serial-locator.md section 7a). Additive only: nullable columns and a
-- boolean with a default on CollectedCPE, and one new table.
-- AlterTable
ALTER TABLE "CollectedCPE" ADD COLUMN     "handoverFormId" UUID,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "opmcId" UUID,
ADD COLUMN     "pstnNumber" TEXT,
ADD COLUMN     "serialUnreadable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CpeHandoverForm" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "formNumber" TEXT NOT NULL,
    "opmcId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "handedOverDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "scanUrl" TEXT,
    "itemCount" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpeHandoverForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CpeHandoverForm_formNumber_key" ON "CpeHandoverForm"("formNumber");

-- CreateIndex
CREATE INDEX "CpeHandoverForm_opmcId_periodMonth_idx" ON "CpeHandoverForm"("opmcId", "periodMonth");

-- CreateIndex
CREATE INDEX "CpeHandoverForm_contractorId_idx" ON "CpeHandoverForm"("contractorId");

-- CreateIndex
CREATE INDEX "CollectedCPE_opmcId_status_idx" ON "CollectedCPE"("opmcId", "status");

-- CreateIndex
CREATE INDEX "CollectedCPE_handoverFormId_idx" ON "CollectedCPE"("handoverFormId");

-- AddForeignKey
ALTER TABLE "CollectedCPE" ADD CONSTRAINT "CollectedCPE_handoverFormId_fkey" FOREIGN KEY ("handoverFormId") REFERENCES "CpeHandoverForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

