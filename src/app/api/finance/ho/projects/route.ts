import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoBillingService } from '@/services/finance/ho-billing.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ho/projects - per project: billed to SLT, collected by Head Office, paid out by Head Office, net
export const GET = apiHandler(async (_req, params) => HoBillingService.position(params._userId ?? ''), { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
