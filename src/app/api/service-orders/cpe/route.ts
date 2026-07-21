import { apiHandler } from '@/lib/api-handler';
import { CpeService } from '@/services/cpe.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET: List collected CPEs with filter options
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId') || undefined;
    const status = searchParams.get('status') || undefined;
    const deviceType = searchParams.get('deviceType') || undefined;

    const cpes = await CpeService.getCollectedCPEs({ contractorId, status, deviceType });
    return { success: true, data: cpes };
}, { rawResponse: true });

const cpeHandbackSchema = z.object({
    ids: z.array(z.string()).min(1, 'IDs array is required'),
    handbackReference: z.string().min(1, 'Handback reference is required')
});

// POST: Submit a handback receipt to SLT (Bulk mark as HANDED_BACK)
export const POST = apiHandler(
    async (_request, _params, body) => {
        const { ids, handbackReference } = body;
        return await CpeService.submitHandback(ids, handbackReference);
    },
    { schema: cpeHandbackSchema, rawResponse: true }
);
