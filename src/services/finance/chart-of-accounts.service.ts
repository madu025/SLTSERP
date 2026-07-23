import { prisma } from '@/lib/prisma';
import { AccountType } from '@prisma/client';
import { AppError } from '@/lib/error';

export interface CreateAccountInput {
    code: string;
    name: string;
    type: AccountType;
    parentId?: string;
    isPostable?: boolean;
}

export interface UpdateAccountInput {
    name?: string;
    type?: AccountType;
    parentId?: string;
    isPostable?: boolean;
    isActive?: boolean;
}

export class ChartOfAccountsService {
    /**
     * Fetch all Chart of Accounts records with hierarchical tree ordering
     */
    static async getAllAccounts() {
        const accounts = await prisma.chartOfAccount.findMany({
            orderBy: { code: 'asc' },
            include: {
                parent: {
                    select: { id: true, code: true, name: true }
                }
            }
        });
        return accounts;
    }

    /**
     * Get single account by Code or ID
     */
    static async getAccountByCode(code: string) {
        const account = await prisma.chartOfAccount.findUnique({
            where: { code }
        });
        if (!account) {
            throw AppError.notFound(`Chart of Account code '${code}' not found`);
        }
        return account;
    }

    /**
     * Create a new Account in CoA
     */
    static async createAccount(input: CreateAccountInput) {
        const existing = await prisma.chartOfAccount.findUnique({
            where: { code: input.code }
        });
        if (existing) {
            throw AppError.badRequest(`Chart of Account code '${input.code}' already exists`);
        }

        if (input.parentId) {
            const parent = await prisma.chartOfAccount.findUnique({
                where: { id: input.parentId }
            });
            if (!parent) {
                throw AppError.badRequest(`Parent account with ID '${input.parentId}' not found`);
            }
        }

        return await prisma.chartOfAccount.create({
            data: {
                code: input.code.toUpperCase().trim(),
                name: input.name.trim(),
                type: input.type,
                parentId: input.parentId || null,
                isPostable: input.isPostable ?? true,
                isActive: true
            }
        });
    }

    /**
     * Update an existing Account in CoA
     */
    static async updateAccount(id: string, input: UpdateAccountInput) {
        const existing = await prisma.chartOfAccount.findUnique({
            where: { id }
        });
        if (!existing) {
            throw AppError.notFound(`Account with ID '${id}' not found`);
        }

        return await prisma.chartOfAccount.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name.trim() }),
                ...(input.type !== undefined && { type: input.type }),
                ...(input.parentId !== undefined && { parentId: input.parentId }),
                ...(input.isPostable !== undefined && { isPostable: input.isPostable }),
                ...(input.isActive !== undefined && { isActive: input.isActive })
            }
        });
    }
}
