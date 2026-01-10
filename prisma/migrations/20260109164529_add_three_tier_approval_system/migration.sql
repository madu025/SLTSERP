/*
  Warnings:

  - You are about to drop the column `area` on the `OPMC` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `OPMC` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[uploadToken]` on the table `Contractor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rtom]` on the table `OPMC` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectCode]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uploadToken]` on the table `TeamMember` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rtom` to the `OPMC` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectCode` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "OPMC_code_key";

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "agreementDuration" INTEGER DEFAULT 1,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankPassbookUrl" TEXT,
ADD COLUMN     "brCertUrl" TEXT,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "documentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "gramaCertUrl" TEXT,
ADD COLUMN     "nic" TEXT,
ADD COLUMN     "nicBackUrl" TEXT,
ADD COLUMN     "nicFrontUrl" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "policeReportUrl" TEXT,
ADD COLUMN     "uploadToken" TEXT,
ADD COLUMN     "uploadTokenExpiry" TIMESTAMP(3),
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "registrationNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "description" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OPMC" DROP COLUMN "area",
DROP COLUMN "code",
ADD COLUMN     "rtom" TEXT NOT NULL,
ADD COLUMN     "storeId" TEXT,
ALTER COLUMN "name" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "contractorId" TEXT,
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "projectCode" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'FTTH',
ADD COLUMN     "variance" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "gramaCertUrl" TEXT,
ADD COLUMN     "nicUrl" TEXT,
ADD COLUMN     "passportPhotoUrl" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "policeReportUrl" TEXT,
ADD COLUMN     "shoeSize" TEXT,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "tshirtSize" TEXT,
ADD COLUMN     "uploadToken" TEXT,
ADD COLUMN     "uploadTokenExpiry" TIMESTAMP(3),
ALTER COLUMN "idCopyNumber" DROP NOT NULL,
ALTER COLUMN "contractorIdCopyNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedStoreId" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "securityAnswer" TEXT,
ADD COLUMN     "securityQuestion" TEXT,
ADD COLUMN     "supervisorId" TEXT;

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "rtom" TEXT NOT NULL,
    "lea" TEXT,
    "soNum" TEXT NOT NULL,
    "voiceNumber" TEXT,
    "orderType" TEXT,
    "serviceType" TEXT,
    "customerName" TEXT,
    "techContact" TEXT,
    "status" TEXT NOT NULL,
    "statusDate" TIMESTAMP(3),
    "address" TEXT,
    "dp" TEXT,
    "package" TEXT,
    "ospPhoneClass" TEXT,
    "phonePurchase" TEXT,
    "sales" TEXT,
    "woroTaskName" TEXT,
    "iptv" TEXT,
    "woroSeit" TEXT,
    "ftthInstSeit" TEXT,
    "ftthWifi" TEXT,
    "sltsStatus" TEXT NOT NULL DEFAULT 'INPROGRESS',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "comments" TEXT,
    "completedDate" TIMESTAMP(3),
    "ontSerialNumber" TEXT,
    "iptvSerialNumbers" TEXT,
    "dpDetails" TEXT,
    "patStatus" TEXT,
    "patDate" TIMESTAMP(3),
    "wiredOnly" BOOLEAN NOT NULL DEFAULT false,
    "delayReasons" JSONB,
    "stbShortage" BOOLEAN NOT NULL DEFAULT false,
    "ontShortage" BOOLEAN NOT NULL DEFAULT false,
    "ontType" TEXT,
    "returnReason" TEXT,
    "completionMode" TEXT,
    "materialSource" TEXT,
    "directTeam" TEXT,
    "opmcId" TEXT NOT NULL,
    "contractorId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreRequest" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestoreRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBOQItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "actualQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBOQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceRef" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorStock" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contractorId" TEXT NOT NULL,
    "opmcId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStoreAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamStoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableColumnSettings" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableColumnSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SUB',
    "location" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SLTS',
    "category" TEXT NOT NULL DEFAULT 'OTHERS',
    "minLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isWastageAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maxWastagePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SLT',
    "commonFor" TEXT[],
    "commonName" TEXT,
    "isOspFtth" BOOLEAN DEFAULT false,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "requestNr" TEXT NOT NULL,
    "fromStoreId" TEXT,
    "toStoreId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "remarks" TEXT,
    "sltReferenceId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "requiredDate" TIMESTAMP(3),
    "purpose" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'SLT',
    "projectTypes" TEXT[],
    "maintenanceMonths" TEXT,
    "workflowStage" TEXT NOT NULL DEFAULT 'REQUEST',
    "procurementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "poNumber" TEXT,
    "vendor" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "irNumber" TEXT,
    "isCoveringPO" BOOLEAN NOT NULL DEFAULT false,
    "armAction" TEXT,
    "armDate" TIMESTAMP(3),
    "armRemarks" TEXT,
    "armApprovedById" TEXT,
    "storesManagerAction" TEXT,
    "storesManagerDate" TIMESTAMP(3),
    "storesManagerRemarks" TEXT,
    "storesManagerApprovedById" TEXT,
    "hsOspAction" TEXT,
    "hsOspDate" TIMESTAMP(3),
    "managerAction" TEXT,
    "managerDate" TIMESTAMP(3),
    "releasedById" TEXT,
    "releasedDate" TIMESTAMP(3),
    "releasedRemarks" TEXT,
    "receivedById" TEXT,
    "receivedDate" TIMESTAMP(3),
    "receivedRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "approvedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issuedQty" DOUBLE PRECISION,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "make" TEXT,
    "model" TEXT,
    "suggestedVendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRN" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "supplier" TEXT,
    "requestId" TEXT,
    "receivedById" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRNItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRNItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MRN" (
    "id" TEXT NOT NULL,
    "mrnNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "returnTo" TEXT,
    "supplier" TEXT,
    "reason" TEXT,
    "grnId" TEXT,
    "returnedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MRNItem" (
    "id" TEXT NOT NULL,
    "mrnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MRNItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InventoryTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialStandard" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "standardQty" DOUBLE PRECISION NOT NULL,
    "maxQty" DOUBLE PRECISION,
    "wastagePercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMaterialIssue" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" TEXT NOT NULL,
    "issuedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorMaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMaterialIssueItem" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "ContractorMaterialIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SODMaterialUsage" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,
    "wastagePercent" DOUBLE PRECISION,
    "exceedsLimit" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SODMaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMaterialReturn" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" TEXT NOT NULL,
    "reason" TEXT,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorMaterialReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMaterialReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',

    CONSTRAINT "ContractorMaterialReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorWastage" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorWastage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorWastageItem" (
    "id" TEXT NOT NULL,
    "wastageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "ContractorWastageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMaterialBalanceSheet" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION,
    "usageRate" DOUBLE PRECISION,
    "wastageRate" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,

    CONSTRAINT "ContractorMaterialBalanceSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorBalanceSheetItem" (
    "id" TEXT NOT NULL,
    "balanceSheetId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "received" DOUBLE PRECISION NOT NULL,
    "returned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL,
    "wastage" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL,
    "requiredNext" DOUBLE PRECISION,

    CONSTRAINT "ContractorBalanceSheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "projectId" TEXT,
    "contractorId" TEXT,
    "teamId" TEXT,
    "recipientName" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIssueItem" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterialReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "returnedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMaterialReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterialReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "ProjectMaterialReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentStock" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSectionAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ServiceOrder_opmcId_idx" ON "ServiceOrder"("opmcId");

-- CreateIndex
CREATE INDEX "ServiceOrder_rtom_idx" ON "ServiceOrder"("rtom");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_idx" ON "ServiceOrder"("status");

-- CreateIndex
CREATE INDEX "ServiceOrder_soNum_idx" ON "ServiceOrder"("soNum");

-- CreateIndex
CREATE INDEX "ServiceOrder_scheduledDate_idx" ON "ServiceOrder"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_soNum_status_key" ON "ServiceOrder"("soNum", "status");

-- CreateIndex
CREATE INDEX "RestoreRequest_status_idx" ON "RestoreRequest"("status");

-- CreateIndex
CREATE INDEX "RestoreRequest_serviceOrderId_idx" ON "RestoreRequest"("serviceOrderId");

-- CreateIndex
CREATE INDEX "RestoreRequest_requestedById_idx" ON "RestoreRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ProjectBOQItem_projectId_idx" ON "ProjectBOQItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBOQItem_category_idx" ON "ProjectBOQItem"("category");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");

-- CreateIndex
CREATE INDEX "ProjectExpense_projectId_idx" ON "ProjectExpense"("projectId");

-- CreateIndex
CREATE INDEX "ProjectExpense_type_idx" ON "ProjectExpense"("type");

-- CreateIndex
CREATE INDEX "ProjectExpense_date_idx" ON "ProjectExpense"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorStock_contractorId_itemId_key" ON "ContractorStock"("contractorId", "itemId");

-- CreateIndex
CREATE INDEX "TeamStoreAssignment_teamId_idx" ON "TeamStoreAssignment"("teamId");

-- CreateIndex
CREATE INDEX "TeamStoreAssignment_storeId_idx" ON "TeamStoreAssignment"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStoreAssignment_teamId_storeId_key" ON "TeamStoreAssignment"("teamId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "TableColumnSettings_tableName_key" ON "TableColumnSettings"("tableName");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_code_key" ON "InventoryItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_storeId_itemId_key" ON "InventoryStock"("storeId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockRequest_requestNr_key" ON "StockRequest"("requestNr");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_grnNumber_key" ON "GRN"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MRN_mrnNumber_key" ON "MRN"("mrnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategory_name_key" ON "MaterialCategory"("name");

-- CreateIndex
CREATE INDEX "MaterialStandard_packageType_idx" ON "MaterialStandard"("packageType");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialStandard_categoryId_packageType_itemId_key" ON "MaterialStandard"("categoryId", "packageType", "itemId");

-- CreateIndex
CREATE INDEX "ContractorMaterialIssue_contractorId_storeId_month_idx" ON "ContractorMaterialIssue"("contractorId", "storeId", "month");

-- CreateIndex
CREATE INDEX "ContractorMaterialIssue_month_idx" ON "ContractorMaterialIssue"("month");

-- CreateIndex
CREATE INDEX "ContractorMaterialIssueItem_issueId_idx" ON "ContractorMaterialIssueItem"("issueId");

-- CreateIndex
CREATE INDEX "ContractorMaterialIssueItem_itemId_idx" ON "ContractorMaterialIssueItem"("itemId");

-- CreateIndex
CREATE INDEX "SODMaterialUsage_serviceOrderId_idx" ON "SODMaterialUsage"("serviceOrderId");

-- CreateIndex
CREATE INDEX "SODMaterialUsage_itemId_idx" ON "SODMaterialUsage"("itemId");

-- CreateIndex
CREATE INDEX "SODMaterialUsage_usageType_idx" ON "SODMaterialUsage"("usageType");

-- CreateIndex
CREATE INDEX "ContractorMaterialReturn_contractorId_storeId_month_idx" ON "ContractorMaterialReturn"("contractorId", "storeId", "month");

-- CreateIndex
CREATE INDEX "ContractorMaterialReturn_status_idx" ON "ContractorMaterialReturn"("status");

-- CreateIndex
CREATE INDEX "ContractorMaterialReturnItem_returnId_idx" ON "ContractorMaterialReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ContractorMaterialReturnItem_itemId_idx" ON "ContractorMaterialReturnItem"("itemId");

-- CreateIndex
CREATE INDEX "ContractorWastage_contractorId_storeId_month_idx" ON "ContractorWastage"("contractorId", "storeId", "month");

-- CreateIndex
CREATE INDEX "ContractorWastageItem_wastageId_idx" ON "ContractorWastageItem"("wastageId");

-- CreateIndex
CREATE INDEX "ContractorWastageItem_itemId_idx" ON "ContractorWastageItem"("itemId");

-- CreateIndex
CREATE INDEX "ContractorMaterialBalanceSheet_month_idx" ON "ContractorMaterialBalanceSheet"("month");

-- CreateIndex
CREATE INDEX "ContractorMaterialBalanceSheet_contractorId_idx" ON "ContractorMaterialBalanceSheet"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorMaterialBalanceSheet_storeId_idx" ON "ContractorMaterialBalanceSheet"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorMaterialBalanceSheet_contractorId_storeId_month_key" ON "ContractorMaterialBalanceSheet"("contractorId", "storeId", "month");

-- CreateIndex
CREATE INDEX "ContractorBalanceSheetItem_balanceSheetId_idx" ON "ContractorBalanceSheetItem"("balanceSheetId");

-- CreateIndex
CREATE INDEX "ContractorBalanceSheetItem_itemId_idx" ON "ContractorBalanceSheetItem"("itemId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE UNIQUE INDEX "StockIssue_issueNumber_key" ON "StockIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "StockIssue_storeId_idx" ON "StockIssue"("storeId");

-- CreateIndex
CREATE INDEX "StockIssue_issueType_idx" ON "StockIssue"("issueType");

-- CreateIndex
CREATE INDEX "StockIssue_status_idx" ON "StockIssue"("status");

-- CreateIndex
CREATE INDEX "StockIssueItem_issueId_idx" ON "StockIssueItem"("issueId");

-- CreateIndex
CREATE INDEX "StockIssueItem_itemId_idx" ON "StockIssueItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMaterialReturn_returnNumber_key" ON "ProjectMaterialReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "ProjectMaterialReturn_projectId_idx" ON "ProjectMaterialReturn"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMaterialReturn_storeId_idx" ON "ProjectMaterialReturn"("storeId");

-- CreateIndex
CREATE INDEX "ProjectMaterialReturn_status_idx" ON "ProjectMaterialReturn"("status");

-- CreateIndex
CREATE INDEX "ProjectMaterialReturnItem_returnId_idx" ON "ProjectMaterialReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ProjectMaterialReturnItem_itemId_idx" ON "ProjectMaterialReturnItem"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_storeId_idx" ON "StockMovement"("storeId");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "CurrentStock_storeId_idx" ON "CurrentStock"("storeId");

-- CreateIndex
CREATE INDEX "CurrentStock_itemId_idx" ON "CurrentStock"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentStock_storeId_itemId_key" ON "CurrentStock"("storeId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Section_code_key" ON "Section"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SystemRole_code_key" ON "SystemRole"("code");

-- CreateIndex
CREATE INDEX "SystemRole_sectionId_idx" ON "SystemRole"("sectionId");

-- CreateIndex
CREATE INDEX "UserSectionAssignment_userId_idx" ON "UserSectionAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserSectionAssignment_sectionId_idx" ON "UserSectionAssignment"("sectionId");

-- CreateIndex
CREATE INDEX "UserSectionAssignment_roleId_idx" ON "UserSectionAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSectionAssignment_userId_sectionId_key" ON "UserSectionAssignment"("userId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_uploadToken_key" ON "Contractor"("uploadToken");

-- CreateIndex
CREATE UNIQUE INDEX "OPMC_rtom_key" ON "OPMC"("rtom");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_opmcId_idx" ON "Project"("opmcId");

-- CreateIndex
CREATE INDEX "Project_contractorId_idx" ON "Project"("contractorId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_uploadToken_key" ON "TeamMember"("uploadToken");

-- AddForeignKey
ALTER TABLE "OPMC" ADD CONSTRAINT "OPMC_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ContractorTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedStoreId_fkey" FOREIGN KEY ("assignedStoreId") REFERENCES "InventoryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreRequest" ADD CONSTRAINT "RestoreRequest_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreRequest" ADD CONSTRAINT "RestoreRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreRequest" ADD CONSTRAINT "RestoreRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBOQItem" ADD CONSTRAINT "ProjectBOQItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBOQItem" ADD CONSTRAINT "ProjectBOQItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorStock" ADD CONSTRAINT "ContractorStock_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorStock" ADD CONSTRAINT "ContractorStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTeam" ADD CONSTRAINT "ContractorTeam_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorTeam" ADD CONSTRAINT "ContractorTeam_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStoreAssignment" ADD CONSTRAINT "TeamStoreAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ContractorTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStoreAssignment" ADD CONSTRAINT "TeamStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ContractorTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStore" ADD CONSTRAINT "InventoryStore_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "InventoryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "InventoryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_armApprovedById_fkey" FOREIGN KEY ("armApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_storesManagerApprovedById_fkey" FOREIGN KEY ("storesManagerApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestItem" ADD CONSTRAINT "StockRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StockRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestItem" ADD CONSTRAINT "StockRequestItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRN" ADD CONSTRAINT "MRN_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRN" ADD CONSTRAINT "MRN_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRN" ADD CONSTRAINT "MRN_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRNItem" ADD CONSTRAINT "MRNItem_mrnId_fkey" FOREIGN KEY ("mrnId") REFERENCES "MRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRNItem" ADD CONSTRAINT "MRNItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransactionItem" ADD CONSTRAINT "InventoryTransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InventoryTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransactionItem" ADD CONSTRAINT "InventoryTransactionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialStandard" ADD CONSTRAINT "MaterialStandard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialStandard" ADD CONSTRAINT "MaterialStandard_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialIssue" ADD CONSTRAINT "ContractorMaterialIssue_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialIssue" ADD CONSTRAINT "ContractorMaterialIssue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialIssueItem" ADD CONSTRAINT "ContractorMaterialIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "ContractorMaterialIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialIssueItem" ADD CONSTRAINT "ContractorMaterialIssueItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SODMaterialUsage" ADD CONSTRAINT "SODMaterialUsage_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SODMaterialUsage" ADD CONSTRAINT "SODMaterialUsage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialReturn" ADD CONSTRAINT "ContractorMaterialReturn_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialReturn" ADD CONSTRAINT "ContractorMaterialReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialReturnItem" ADD CONSTRAINT "ContractorMaterialReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ContractorMaterialReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialReturnItem" ADD CONSTRAINT "ContractorMaterialReturnItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWastage" ADD CONSTRAINT "ContractorWastage_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWastage" ADD CONSTRAINT "ContractorWastage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWastageItem" ADD CONSTRAINT "ContractorWastageItem_wastageId_fkey" FOREIGN KEY ("wastageId") REFERENCES "ContractorWastage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWastageItem" ADD CONSTRAINT "ContractorWastageItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialBalanceSheet" ADD CONSTRAINT "ContractorMaterialBalanceSheet_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMaterialBalanceSheet" ADD CONSTRAINT "ContractorMaterialBalanceSheet_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBalanceSheetItem" ADD CONSTRAINT "ContractorBalanceSheetItem_balanceSheetId_fkey" FOREIGN KEY ("balanceSheetId") REFERENCES "ContractorMaterialBalanceSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorBalanceSheetItem" ADD CONSTRAINT "ContractorBalanceSheetItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssueItem" ADD CONSTRAINT "StockIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "StockIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssueItem" ADD CONSTRAINT "StockIssueItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturn" ADD CONSTRAINT "ProjectMaterialReturn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturn" ADD CONSTRAINT "ProjectMaterialReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "InventoryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturn" ADD CONSTRAINT "ProjectMaterialReturn_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturn" ADD CONSTRAINT "ProjectMaterialReturn_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturnItem" ADD CONSTRAINT "ProjectMaterialReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ProjectMaterialReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialReturnItem" ADD CONSTRAINT "ProjectMaterialReturnItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemRole" ADD CONSTRAINT "SystemRole_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSectionAssignment" ADD CONSTRAINT "UserSectionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSectionAssignment" ADD CONSTRAINT "UserSectionAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSectionAssignment" ADD CONSTRAINT "UserSectionAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SystemRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
