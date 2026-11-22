import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AreaManagerDeskService } from '@/services/service-order/area-manager-desk.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/area-manager-desk - what waits for the Area Manager and the money of the billing month, for their own areas (read-only)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return (await AreaManagerDeskService.forUser(params._userId ?? '', { month: Number(sp.get('month')) || undefined, year: Number(sp.get('year')) || undefined, rtom: sp.get('rtom') ?? undefined }))
        ?? { month: '', monthNumber: 0, year: 0, rtom: 'ALL', invoices: { count: 0, total: 0, oldestDays: null, list: [] }, inApproval: [], stuckDays: 3, contractorRegistrations: { count: 0, list: [] }, month_figures: { invoices: 0, orders: 0, contractorAmount: 0, revenueAmount: 0, marginPct: null, approvedByArea: 0, approvedAmount: 0 } };
}, { permissions: [RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER] });
