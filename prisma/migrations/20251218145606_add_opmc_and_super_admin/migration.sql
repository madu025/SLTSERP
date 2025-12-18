-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "opmcId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "opmcId" TEXT;

-- CreateTable
CREATE TABLE "OPMC" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OPMC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OPMC_code_key" ON "OPMC"("code");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
