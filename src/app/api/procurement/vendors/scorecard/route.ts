import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { VendorScorecardService } from '@/services/procurement/vendor-scorecard.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/vendors/scorecard?months=12
// Vendor spend, on-time delivery, rejects and lead time from project purchase orders and goods receipts.
export const GET = apiHandler(async (req, params) => {
    const months = Number(new URL(req.url).searchParams.get('months') ?? 12);
    return VendorScorecardService.getScorecard(params._userId ?? '', Number.isFinite(months) ? months : 12);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });
