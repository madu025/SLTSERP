import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoPaymentService } from '@/services/procurement/ho-payment.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/vendor-payments
// Vendor Payment Status: every OSP vendor voucher with HO or paid by HO, what HO paid, what is still to pay, and each payment the HO Account
// Executive recorded. Company-wide, like the voucher chain (a vendor payment belongs to no area).
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return HoPaymentService.statusList();
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ] });
