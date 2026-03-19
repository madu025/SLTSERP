-- Migration: add_contractor_registration_fields
-- Adds all columns that were added to schema.prisma but never migrated

-- Registration fields
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "registrationFeeSlipUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "registrationToken" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "registrationExpiry" TIMESTAMP(3);
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "siteOfficeStaffId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "documentStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "brNumber" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "svat" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "bankAccountHolderName" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "bankBranchId" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "nic" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "nicFrontUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "nicBackUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "brCertificateUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "vatCertificateUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "svatCertificateUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "bankDepositSlipUrl" TEXT;
