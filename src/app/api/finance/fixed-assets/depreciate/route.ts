import { apiHandler } from '@/lib/api-handler';

import { FixedAssetService } from '@/services/finance/fixed-asset.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const depreciationSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
}).strict();
type DepreciationRequest = z.infer<typeof depreciationSchema>;

export const POST = apiHandler<unknown, DepreciationRequest>(async (_req, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const result = await FixedAssetService.runMonthlyDepreciation(
        body.year,
        body.month,
        userId
    );

    return result;
}, {
    schema: depreciationSchema,
    audit: { action: 'RUN_DEPRECIATION', entity: 'FIXED_ASSET' }
});
