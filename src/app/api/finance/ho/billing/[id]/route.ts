import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoBillingService } from '@/services/finance/ho-billing.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ho/billing/[id] - the evidence pack for one billing submission
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return HoBillingService.pack(params._userId, params.id);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
