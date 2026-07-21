import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (req, params) => {
    const { id } = params;
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const origin = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin);

    if (!id) {
        throw AppError.badRequest('Contractor ID is required');
    }

    const result = await ContractorService.resendRegistrationLink(id, origin);
    return Response.json({ success: true, ...result });
});
