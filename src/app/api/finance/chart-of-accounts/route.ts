import { apiHandler } from '@/lib/api-handler';
import { ChartOfAccountsService } from '@/services/finance/chart-of-accounts.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

const CreateAccountSchema = z.object({
    code: z.string().min(2).max(20),
    name: z.string().min(2).max(100),
    type: AccountTypeEnum,
    parentId: z.string().optional(),
    isPostable: z.boolean().optional()
});

const UpdateAccountSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(2).max(100).optional(),
    type: AccountTypeEnum.optional(),
    parentId: z.string().optional(),
    isPostable: z.boolean().optional(),
    isActive: z.boolean().optional()
});

export const GET = apiHandler(async () => {
    const accounts = await ChartOfAccountsService.getAllAccounts();
    return { accounts };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const validated = CreateAccountSchema.parse(body);
    const account = await ChartOfAccountsService.createAccount(validated);
    return { account };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});

export const PUT = apiHandler(async (req) => {
    const body = await req.json();
    const validated = UpdateAccountSchema.parse(body);
    const { id, ...data } = validated;
    const account = await ChartOfAccountsService.updateAccount(id, data);
    return { account };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
