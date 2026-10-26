import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const schema = z.object({
    sodIds: z.array(z.string()).min(1, 'At least one SOD ID is required'),
    notes: z.string().optional()
});

export const POST = apiHandler(async (req: Request) => {
    const json = await req.json();
    const { sodIds, notes } = schema.parse(json);
    const userId = req.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Authenticated verification user is required');

    const { count, verifiedIds, rejected } = await ServiceOrderService.verifyInvoicable(sodIds, userId, notes);

    return {
        success: true,
        message: `Successfully verified and marked ${count} SOD(s) as Invoicable by Engineer / SF Audit`,
        count,
        verifiedIds,
        rejected
    };
}, {
    permissions: [RBAC_PERMISSIONS.SOD_INVOICE],
    audit: { action: 'VERIFY_SOD_INVOICABLE', entity: 'ServiceOrder' }
});
