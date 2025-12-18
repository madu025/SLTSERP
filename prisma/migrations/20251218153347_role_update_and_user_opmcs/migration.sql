-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ASSISTANT_ENGINEER';
ALTER TYPE "Role" ADD VALUE 'OFFICE_ADMIN';
ALTER TYPE "Role" ADD VALUE 'OFFICE_ADMIN_ASSISTANT';
ALTER TYPE "Role" ADD VALUE 'FINANCE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'FINANCE_ASSISTANT';
ALTER TYPE "Role" ADD VALUE 'INVOICE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'INVOICE_ASSISTANT';
ALTER TYPE "Role" ADD VALUE 'STORES_MANAGER';
ALTER TYPE "Role" ADD VALUE 'STORES_ASSISTANT';
ALTER TYPE "Role" ADD VALUE 'SA_MANAGER';
ALTER TYPE "Role" ADD VALUE 'SA_ASSISTANT';

-- CreateTable
CREATE TABLE "_UserOpmcs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserOpmcs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserOpmcs_B_index" ON "_UserOpmcs"("B");

-- AddForeignKey
ALTER TABLE "_UserOpmcs" ADD CONSTRAINT "_UserOpmcs_A_fkey" FOREIGN KEY ("A") REFERENCES "OPMC"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserOpmcs" ADD CONSTRAINT "_UserOpmcs_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
