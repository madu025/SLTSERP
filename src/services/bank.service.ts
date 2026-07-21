import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class BankService {
    static async getBanks() {
        return await prisma.bank.findMany({
            orderBy: { name: 'asc' }
        });
    }

    static async createBank(data: { code: string; name: string }) {
        const existing = await prisma.bank.findUnique({
            where: { code: data.code }
        });

        if (existing) {
            throw AppError.badRequest("Bank with this code already exists");
        }

        return await prisma.bank.create({
            data: { code: data.code, name: data.name }
        });
    }

    static async updateBank(bankId: string, data: { name: string; code: string }) {
        const existing = await prisma.bank.findUnique({
            where: { id: bankId }
        });

        if (!existing) {
            throw AppError.notFound("Bank not found");
        }

        if (data.code !== existing.code) {
            const codeExists = await prisma.bank.findUnique({
                where: { code: data.code }
            });
            if (codeExists) {
                throw AppError.badRequest("Bank with this code already exists");
            }
        }

        return await prisma.bank.update({
            where: { id: bankId },
            data: { name: data.name, code: data.code }
        });
    }

    static async deleteBank(bankId: string) {
        const existing = await prisma.bank.findUnique({
            where: { id: bankId }
        });

        if (!existing) {
            throw AppError.notFound("Bank not found");
        }

        await prisma.bank.delete({
            where: { id: bankId }
        });

        return { success: true };
    }

    static async getBranches(bankId: string) {
        return await prisma.bankBranch.findMany({
            where: { bankId },
            orderBy: { name: 'asc' }
        });
    }

    static async getAllBranches() {
        return await prisma.bankBranch.findMany({
            orderBy: { name: 'asc' },
            include: { bank: true }
        });
    }

    static async createBranch(bankId: string, data: { code: string; name: string }) {
        const existing = await prisma.bankBranch.findUnique({
            where: { bankId_code: { bankId, code: data.code } }
        });

        if (existing) {
            throw AppError.badRequest("Branch with this code already exists under this bank");
        }

        return await prisma.bankBranch.create({
            data: { bankId, code: data.code, name: data.name }
        });
    }

    static async updateBranch(bankId: string, branchId: string, data: { name: string; code: string }) {
        const existing = await prisma.bankBranch.findUnique({
            where: { id: branchId }
        });

        if (!existing) {
            throw AppError.notFound("Branch not found");
        }

        if (data.code !== existing.code) {
            const codeExists = await prisma.bankBranch.findUnique({
                where: { bankId_code: { bankId, code: data.code } }
            });
            if (codeExists) {
                throw AppError.badRequest("Branch with this code already exists under this bank");
            }
        }

        return await prisma.bankBranch.update({
            where: { id: branchId },
            data: { name: data.name, code: data.code }
        });
    }

    static async deleteBranch(branchId: string) {
        const existing = await prisma.bankBranch.findUnique({
            where: { id: branchId }
        });

        if (!existing) {
            throw AppError.notFound("Branch not found");
        }

        await prisma.bankBranch.delete({
            where: { id: branchId }
        });

        return { success: true };
    }

    static async importBulk(banksData: Array<{ bankCode: string; bankName: string; branchCode?: string; branchName?: string }>) {
        let successCount = 0;
        let failedCount = 0;
        const errors: { row: number; error: string }[] = [];

        // We process banks row by row. If a bank exists, we just add the branch to it.
        for (let i = 0; i < banksData.length; i++) {
            const data = banksData[i];
            try {
                // Find or Create the Bank
                let bank = await prisma.bank.findFirst({
                    where: { code: data.bankCode }
                });

                if (!bank) {
                    bank = await prisma.bank.create({
                        data: {
                            code: data.bankCode,
                            name: data.bankName
                        }
                    });
                }

                // If branch data is provided, add it to the bank
                if (data.branchCode && data.branchName) {
                    const existingBranch = await prisma.bankBranch.findFirst({
                        where: { bankId: bank.id, code: data.branchCode }
                    });

                    if (!existingBranch) {
                        await prisma.bankBranch.create({
                            data: {
                                bankId: bank.id,
                                code: data.branchCode,
                                name: data.branchName
                            }
                        });
                    }
                }
                
                successCount++;
            } catch (err: unknown) {
                failedCount++;
                const errorMsg = err instanceof Error ? err.message : "Failed to process bank/branch";
                errors.push({ row: i + 1, error: errorMsg });
            }
        }

        return { successCount, failedCount, errors };
    }
}
