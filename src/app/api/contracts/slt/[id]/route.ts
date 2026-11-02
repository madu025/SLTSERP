import { apiHandler } from '@/lib/api-handler';
import { SLTContractService } from '@/services/slt/slt-contract.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// Contract deletion is destructive — manager-level write scope

export const DELETE = apiHandler(
    async (req: Request, params: Record<string, unknown>) => {
        const resolvedParams = params instanceof Promise ? await params : params;
        const urlPathId = new URL(req.url).pathname.split('/').filter(Boolean).pop();
        const id = resolvedParams?.id || urlPathId;

        if (!id) {
            throw AppError.badRequest('Contract ID is required');
        }

        const result = await SLTContractService.deleteContract(id);
        return result;
    },
    {
        audit: { action: 'SLT_CONTRACT_DELETE', entity: 'SLTContract' }
    }
);
