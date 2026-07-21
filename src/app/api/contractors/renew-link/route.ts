import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

const renewSchema = z.object({
    id: z.string().min(1, "Contractor ID is required")
});

export const POST = apiHandler(async (req, _params, body) => {
    const data = renewSchema.parse(body);
    
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const origin = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin);

    const result = await ContractorService.generateRenewalLink(data.id, origin);
    return Response.json({ success: true, ...result });
}, {
    audit: { action: 'GENERATE_RENEWAL_LINK', entity: 'Contractor' }
});
