import { apiHandler } from '@/lib/api-handler';
import { SLTContractService } from '@/services/slt-contract.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
    async (req: Request) => {
        const url = new URL(req.url);
        const year = Number(url.searchParams.get('year')) || new Date().getFullYear();

        const performance = await SLTContractService.getAnnual12MonthPerformance(year);
        return performance;
    }
);
