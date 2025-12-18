/*
  Warnings:

  - You are about to drop the column `companyName` on the `Contractor` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Contractor` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Contractor` table. All the data in the column will be lost.
  - You are about to drop the column `registrationNo` on the `Contractor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[registrationNumber]` on the table `Contractor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `registrationNumber` to the `Contractor` table without a default value. This is not possible if the table is not empty.
  - Made the column `address` on table `Contractor` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- DropIndex
DROP INDEX "Contractor_registrationNo_key";

-- AlterTable
ALTER TABLE "Contractor" DROP COLUMN "companyName",
DROP COLUMN "email",
DROP COLUMN "phone",
DROP COLUMN "registrationNo",
ADD COLUMN     "agreementDate" TIMESTAMP(3),
ADD COLUMN     "agreementSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "brNumber" TEXT,
ADD COLUMN     "registrationFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationNumber" TEXT NOT NULL,
ADD COLUMN     "status" "ContractorStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "address" SET NOT NULL;

-- AlterTable
ALTER TABLE "OPMC" ADD COLUMN     "province" TEXT NOT NULL DEFAULT 'METRO 01',
ADD COLUMN     "region" TEXT NOT NULL DEFAULT 'METRO';

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idCopyNumber" TEXT NOT NULL,
    "contractorIdCopyNumber" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_registrationNumber_key" ON "Contractor"("registrationNumber");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
