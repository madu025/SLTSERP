-- OSP account items (IOU, project advance, property rent, fuel deposit, vehicle hiring): record who made and who approved, so the maker cannot approve.
-- Additive and idempotent; rows recorded before this have no maker and stay approvable.
ALTER TABLE "OspPettyCashIou" ADD COLUMN IF NOT EXISTS "createdById" UUID, ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE "OspProjectAdvance" ADD COLUMN IF NOT EXISTS "createdById" UUID, ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE "OspPropertyRentPayment" ADD COLUMN IF NOT EXISTS "createdById" UUID, ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE "OspFuelDepositLedger" ADD COLUMN IF NOT EXISTS "createdById" UUID, ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE "OspVehicleHiringPayment" ADD COLUMN IF NOT EXISTS "createdById" UUID, ADD COLUMN IF NOT EXISTS "approvedById" UUID;
