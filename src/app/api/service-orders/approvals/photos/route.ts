import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { SodApprovalService } from '@/services/service-order/sod-approval.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    sodIds: z.array(databaseUuidSchema).min(1).max(200),
    /** true: the photos of these orders were received and checked; false: take the statement back (only while the order is not yet passed). */
    checked: z.boolean(),
});

// POST /api/service-orders/approvals/photos - tick or clear "photos received and checked" on finished orders of the caller's own area. Whether the caller
// holds the check step is decided per order by the gate; an order that then has its connection, material and photos in order is passed to ready.
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    return SodApprovalService.setPhotos(userId, body.sodIds, body.checked);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.DASHBOARD_READ], audit: { action: 'SOD_PHOTOS_CHECKED', entity: 'ServiceOrder' } });
