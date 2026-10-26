export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { InvoiceService } from '@/services/invoice/invoice.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
const createPenaltySchema = z.object({
    amount: z.union([z.string(), z.number()]).transform(val => parseFloat(String(val))),
    reason: z.string().optional(),
    description: z.string().optional(),
    serviceOrderId: z.string().optional()
});
const updatePenaltySchema = z.object({
    penaltyId: z.string().min(1, 'Penalty ID is required'),
    status: z.enum(['APPROVED', 'REJECTED'])
});
export const POST = apiHandler(async (req, params, body) => {
    const { id } = params;
    const data = createPenaltySchema.parse(body);
    if (isNaN(data.amount) || data.amount <= 0) {
        throw AppError.badRequest('Valid penalty amount is required');
    }
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        throw AppError.unauthorized('Authentication required');
    }
    const penalty = await InvoiceService.proposePenalty(
        id,
        data.amount,
        data.reason || 'MANUAL',
        data.description,
        data.serviceOrderId,
        userId,
    );
    return Response.json({ success: true, penalty });
}, {
    permissions: [RBAC_PERMISSIONS.SOD_INVOICE],
    audit: { action: 'PROPOSE_PENALTY', entity: 'Penalty' }
});
export const PATCH = apiHandler(async (req, params, body) => {
    const { id } = params;
    const data = updatePenaltySchema.parse(body);
    const penalty = await InvoiceService.updatePenaltyStatus(id, data.penaltyId, data.status);
    return Response.json({ success: true, penalty });
}, {
    permissions: [RBAC_PERMISSIONS.SOD_INVOICE],
    audit: { action: 'UPDATE_PENALTY_STATUS', entity: 'Penalty' }
});
export const DELETE = apiHandler(async (req, params) => {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const penaltyId = searchParams.get('penaltyId');
    if (!penaltyId) {
        throw AppError.badRequest('Penalty ID is required');
    }
    await InvoiceService.deletePenalty(id, penaltyId);
    return Response.json({ success: true });
}, {
    permissions: [RBAC_PERMISSIONS.SOD_INVOICE],
    audit: { action: 'DELETE_PENALTY', entity: 'Penalty' }
});
