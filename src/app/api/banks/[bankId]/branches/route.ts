import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

const createBranchSchema = z.object({
    code: z.string().min(1, "Branch code is required"),
    name: z.string().min(1, "Branch name is required")
});

export const GET = apiHandler(async (_request: Request, params: any) => {
    const { bankId } = params;
    const branches = await BankService.getBranches(bankId);
    return Response.json(branches);
});

export const POST = apiHandler(async (_request: Request, params: any, body: any) => {
    const { bankId } = params;
    const data = createBranchSchema.parse(body);
    const branch = await BankService.createBranch(bankId, data);
    return Response.json(branch, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'BankBranch' }
});
