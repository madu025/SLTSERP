-- Fix ContractorStock and ContractorBatchStock quantity type from Float to Decimal
-- Aligns with InventoryStock which already uses Decimal(12,4) for precision consistency

ALTER TABLE "ContractorStock" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,4) USING "quantity"::DECIMAL(12,4);
ALTER TABLE "ContractorStock" ALTER COLUMN "quantity" SET DEFAULT 0;

ALTER TABLE "ContractorBatchStock" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,4) USING "quantity"::DECIMAL(12,4);
ALTER TABLE "ContractorBatchStock" ALTER COLUMN "quantity" SET DEFAULT 0;
