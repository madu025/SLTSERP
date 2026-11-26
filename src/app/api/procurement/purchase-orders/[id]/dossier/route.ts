import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PurchaseOrderService } from '@/services/procurement/purchase-order.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/purchase-orders/:id/dossier
// One purchase order with its whole approval history, receipts, supplier invoices and audit trail, for audit and printing.
export const GET = apiHandler(async (_req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = z.object({ id: databaseUuidSchema }).parse(params);
    return PurchaseOrderService.dossier(id, userId);
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ] });
