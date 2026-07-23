import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createBranchSchema = z.object({
    code: z.string().min(1, "Branch code is required"),
    name: z.string().min(1, "Branch name is required")
});

export const GET = apiHandler(async (_request: Request, params: any) => {
    const { bankId } = params;
    return await BankService.getBranches(bankId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request: Request, params: any, body: any) => {
    const { bankId } = params;
    const data = createBranchSchema.parse(body);
    return await BankService.createBranch(bankId, data);
}, {
    audit: { action: 'CREATE', entity: 'BankBranch' },
    rawResponse: true
});
