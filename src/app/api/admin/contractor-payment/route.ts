import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';

 
import { apiHandler } from '@/lib/api-handler';
import { ContractorPaymentService } from '@/services/admin/contractor-payment.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const createConfigSchema = z.object({
    rtomId: z.string().optional().nullable(),
    notes: z.string().optional(),
    tiers: z.array(z.object({
        minDistance: z.union([z.string(), z.number()]),
        maxDistance: z.union([z.string(), z.number()]),
        amount: z.union([z.string(), z.number()])
    })).min(1, 'Pricing tiers are required')
});

const updateConfigSchema = z.object({
    id: z.string().min(1, 'Configuration ID is required'),
    rtomId: z.string().optional().nullable(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
    tiers: z.array(z.object({
        minDistance: z.union([z.string(), z.number()]),
        maxDistance: z.union([z.string(), z.number()]),
        amount: z.union([z.string(), z.number()])
    })).optional()
});

export const GET = apiHandler(async () => {
    const data = await ContractorPaymentService.getConfigs();
    return data;
}, {
});

export const POST = apiHandler(async (req, _params, body) => {
    const userId = getAuthenticatedUserId() || undefined;
    const data = createConfigSchema.parse(body);

    const config = await ContractorPaymentService.createConfig(data, userId);
    return config;
}, {
    audit: { action: 'CREATE_PAYMENT_CONFIG', entity: 'Admin' }
});

export const PUT = apiHandler(async (_req, _params, body) => {
    const data = updateConfigSchema.parse(body);

    const config = await ContractorPaymentService.updateConfig(data.id, data);
    return config;
}, {
    audit: { action: 'UPDATE_PAYMENT_CONFIG', entity: 'Admin' }
});

export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Configuration ID required');
    }

    await ContractorPaymentService.deleteConfig(id);
    return { success: true, message: 'Configuration deleted successfully' };
}, {
    audit: { action: 'DELETE_PAYMENT_CONFIG', entity: 'Admin' }
});
