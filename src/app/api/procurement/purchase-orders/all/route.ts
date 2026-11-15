import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { UnifiedPoService } from '@/services/procurement/unified-po.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/purchase-orders/all?kind=STORE|PROJECT&status=
// Store and project purchase orders in one list with one status vocabulary.
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    const kind = sp.get('kind');
    return UnifiedPoService.list(params._userId ?? '', { kind: kind === 'STORE' || kind === 'PROJECT' ? kind : undefined, status: sp.get('status') || undefined });
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });
