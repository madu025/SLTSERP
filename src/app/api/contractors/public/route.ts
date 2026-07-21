import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const submitDocumentsSchema = z.object({
    token: z.string().min(1, "Token required"),
    documents: z.any()
});

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
        throw AppError.badRequest('Token required');
    }

    const contractor = await ContractorService.verifyUploadToken(token);

    return Response.json({
        isValid: true,
        contractor: {
            name: contractor.name,
            documents: {
                photoUrl: contractor.photoUrl,
                nicFrontUrl: contractor.nicFrontUrl,
                nicBackUrl: contractor.nicBackUrl,
                policeReportUrl: contractor.policeReportUrl,
                gramaCertUrl: contractor.gramaCertUrl,
                bankPassbookUrl: contractor.bankPassbookUrl,
                brCertUrl: contractor.brCertUrl,
                bankName: contractor.bankName,
                bankBranch: contractor.bankBranch,
                bankAccountNumber: contractor.bankAccountNumber
            }
        }
    });
});

export const POST = apiHandler(async (_req, _params, body) => {
    const data = submitDocumentsSchema.parse(body);
    await ContractorService.submitPublicDocuments(data.token, data.documents);
    return Response.json({ success: true });
}, {
    audit: { action: 'SUBMIT_PUBLIC_DOCS', entity: 'Contractor' }
});
