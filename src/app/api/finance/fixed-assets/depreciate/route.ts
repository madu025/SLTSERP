import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { FixedAssetService } from '@/services/finance/fixed-asset.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const { year, month } = body;

    if (!year || !month) {
        throw AppError.badRequest('year and month are required for depreciation run');
    }

    const userId = (req as Request & { user?: { id?: string } }).user?.id;

    const result = await prisma.$transaction(async (tx) => {
        return await FixedAssetService.runMonthlyDepreciation(
            tx,
            Number(year),
            Number(month),
            userId
        );
    });

    return result;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
