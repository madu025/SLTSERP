import { apiHandler } from '@/lib/api-handler';
import { PeriodCloseService } from '@/services/finance/period-close.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { z } from 'zod';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

const closeSchema = z.object({ year: z.number().int().min(2000).max(2100) });

export const POST = apiHandler(async (_req, params, body: z.infer<typeof closeSchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (await resolveOpmcScope(params._userId) !== undefined) {
        throw AppError.forbidden('Year-end close requires global Finance scope');
    }
    const result = await PeriodCloseService.executeYearEndClose(body.year, params._userId);

    return result;
}, {
    schema: closeSchema,
    permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'CLOSE_PERIOD', entity: 'FISCAL_PERIOD' }
});
