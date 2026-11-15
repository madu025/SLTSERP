import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
    bankName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().min(3).max(60),
    branchName: z.string().trim().max(120).nullish(),
    glAccountCode: z.string().trim().min(3).max(40).default('BANK-1000'),
    currency: z.string().trim().length(3).default('LKR'),
});

// POST /api/finance/bank/accounts - register a bank account that vendor payments are made from.
// Each account points at a postable asset account of the chart; payments credit that account.
export const POST = apiHandler(async (_req, params, body: z.infer<typeof createSchema>) => {
    if (await resolveOpmcScope(params._userId) !== undefined) throw AppError.forbidden('Bank accounts require global Finance scope');
    const gl = await prisma.chartOfAccount.findUnique({ where: { code: body.glAccountCode }, select: { type: true, isPostable: true, isActive: true } });
    if (!gl || !gl.isActive || !gl.isPostable || gl.type !== 'ASSET') throw AppError.badRequest('GL_ACCOUNT_INVALID: the ledger account must be an active, postable asset account');
    if (await prisma.bankAccount.findUnique({ where: { accountNumber: body.accountNumber }, select: { id: true } })) throw AppError.conflict('A bank account with this number already exists');
    return prisma.bankAccount.create({ data: { bankName: body.bankName, accountNumber: body.accountNumber, branchName: body.branchName ?? null, glAccountCode: body.glAccountCode, currency: body.currency }, select: { id: true, bankName: true, accountNumber: true, glAccountCode: true } });
}, {
    schema: createSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'CREATE_BANK_ACCOUNT', entity: 'BANK_ACCOUNT' },
});
