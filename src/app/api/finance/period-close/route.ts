import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { PeriodCloseService } from '@/services/finance/period-close.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const { year } = body;

    if (!year) {
        throw AppError.badRequest('year is required for period close');
    }

    const userId = req.headers.get('x-user-id') || (req as Request & { user?: { id?: string } }).user?.id || undefined;

    const result = await prisma.$transaction(async (tx) => {
        return await PeriodCloseService.executeYearEndClose(
            tx,
            Number(year),
            userId
        );
    });

    return result;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
