import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SodApprovalService } from '@/services/service-order/sod-approval.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/approvals/summary - what waits for the caller at the approval steps they hold (read-only, own area only).
// Like the approvals list, it needs only a signed-in user: someone who holds no step gets an empty summary.
export const GET = apiHandler(async (_req, params) => SodApprovalService.summary(params._userId ?? ''), { permissions: [RBAC_PERMISSIONS.DASHBOARD_READ] });
