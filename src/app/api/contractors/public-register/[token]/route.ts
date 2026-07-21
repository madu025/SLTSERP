import { apiHandler } from '@/lib/api-handler';
import { ContractorService } from '@/services/contractor.service';
import { z } from 'zod';

const registrationSchema = z.any(); // Assuming dynamic registration payload
const draftSchema = z.any();

export const GET = apiHandler(async (_req, params) => {
    const { token } = params;
    const contractor = await ContractorService.getContractorByToken(token);
    return Response.json(contractor);
});

export const POST = apiHandler(async (_req, params, body) => {
    const data = registrationSchema.parse(body);
    const { token } = params;
    await ContractorService.submitPublicRegistration(token, data);
    return Response.json({ success: true, message: 'Registration submitted for review.' });
}, {
    audit: { action: 'SUBMIT_PUBLIC_REGISTRATION', entity: 'Contractor' }
});

export const PATCH = apiHandler(async (_req, params, body) => {
    const data = draftSchema.parse(body);
    const { token } = params;
    await ContractorService.saveRegistrationDraft(token, data);
    return Response.json({ success: true, message: 'Draft saved.' });
});
