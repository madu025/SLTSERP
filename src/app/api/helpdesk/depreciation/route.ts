import { apiHandler } from '@/lib/api-handler';
import { z } from 'zod';
import { ITAssetDepreciationService } from '@/services/helpdesk/asset-depreciation.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    return await ITAssetDepreciationService.getDepreciationSchedule();
});

export const POST = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Authentication required');
    }

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
        period: z.string().optional()
    });

    const parsed = schema.parse(body);
    const period = parsed.period || new Date().toISOString().substring(0, 7);

    const result = await ITAssetDepreciationService.postMonthlyDepreciation(period, userId);

    return {
        success: true,
        period,
        ...result
    };
});
