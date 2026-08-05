import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
    sodIds: z.array(z.string()).min(1, 'At least one SOD ID is required'),
    notes: z.string().optional()
});

export const POST = apiHandler(async (req: Request) => {
    const json = await req.json();
    const { sodIds, notes } = schema.parse(json);
    const userId = req.headers.get('x-user-id') || 'system-engineer';

    const { count, verifiedIds } = await ServiceOrderService.verifyInvoicable(sodIds, userId, notes);

    return {
        success: true,
        message: `Successfully verified and marked ${count} SOD(s) as Invoicable by Engineer / SF Audit`,
        count,
        verifiedIds
    };
}, {
    audit: { action: 'VERIFY_SOD_INVOICABLE', entity: 'ServiceOrder' }
});
