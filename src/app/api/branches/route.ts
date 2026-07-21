import { apiHandler } from '@/lib/api-handler';
import { BankService } from '@/services/bank.service';

export const GET = apiHandler(async () => {
    const branches = await BankService.getAllBranches();
    return Response.json(branches);
});
