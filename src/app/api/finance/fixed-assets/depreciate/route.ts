import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

import { FixedAssetService } from '@/services/finance/fixed-asset.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const { year, month } = body;

    if (!year || !month) {
        throw AppError.badRequest('year and month are required for depreciation run');
    }

    const userId = req.headers.get('x-user-id') || (req as Request & { user?: { id?: string } }).user?.id || undefined;

    const result = await FixedAssetService.runMonthlyDepreciation(
        Number(year),
        Number(month),
        userId
    );

    return result;
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'RUN_DEPRECIATION', entity: 'FIXED_ASSET' }
});
