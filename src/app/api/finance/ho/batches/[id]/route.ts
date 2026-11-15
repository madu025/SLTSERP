import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoBatchService } from '@/services/finance/ho-batch.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ho/batches/[id] - the evidence pack for one submission
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return HoBatchService.pack(params._userId, params.id);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
