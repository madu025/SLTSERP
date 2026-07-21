import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';
import { z } from 'zod';

const updateBranchSchema = z.object({
    code: z.string().min(1, "Branch code is required"),
    name: z.string().min(1, "Branch name is required")
});

export const PUT = apiHandler(async (_request: Request, params: any, body: any) => {
    const { bankId, branchId } = params;
    const data = updateBranchSchema.parse(body);
    const branch = await BankService.updateBranch(bankId, branchId, data);
    return Response.json(branch);
}, {
    audit: { action: 'UPDATE', entity: 'BankBranch' }
});

export const DELETE = apiHandler(async (_request: Request, params: any) => {
    const { branchId } = params;
    await BankService.deleteBranch(branchId);
    return Response.json({ message: "Branch deleted successfully" });
}, {
    audit: { action: 'DELETE', entity: 'BankBranch' }
});
