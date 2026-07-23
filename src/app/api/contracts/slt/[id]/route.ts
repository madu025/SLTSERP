import { apiHandler } from '@/lib/api-handler';
import { SLTContractService } from '@/services/slt-contract.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(
    async (req: Request, params: any) => {
        const resolvedParams = params instanceof Promise ? await params : params;
        const urlPathId = new URL(req.url).pathname.split('/').filter(Boolean).pop();
        const id = resolvedParams?.id || urlPathId;

        if (!id) {
            throw new Error('Contract ID is required');
        }

        const result = await SLTContractService.deleteContract(id);
        return result;
    }
);
