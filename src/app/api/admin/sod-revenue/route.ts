import { apiHandler } from '@/lib/api-handler';
import { SodRevenueService } from '@/services/admin/sod-revenue.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const createConfigSchema = z.object({
    rtomId: z.string().optional().nullable(),
    revenuePerSOD: z.union([z.string(), z.number()]),
    effectiveFrom: z.union([z.string(), z.date()]).optional().nullable(),
    effectiveTo: z.union([z.string(), z.date()]).optional().nullable(),
    circularRef: z.string().optional(),
    notes: z.string().optional()
});

const updateConfigSchema = z.object({
    id: z.string().min(1, 'Configuration ID is required'),
    rtomId: z.string().optional().nullable(),
    revenuePerSOD: z.union([z.string(), z.number()]).optional(),
    effectiveFrom: z.union([z.string(), z.date()]).optional().nullable(),
    effectiveTo: z.union([z.string(), z.date()]).optional().nullable(),
    circularRef: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional()
});

export const GET = apiHandler(async () => {
    const configs = await SodRevenueService.getConfigs();
    return Response.json({ success: true, data: configs });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER']
});

export const POST = apiHandler(async (req, _params, body) => {
    const userId = req.headers.get('x-user-id') || undefined;
    const data = createConfigSchema.parse(body);

    const config = await SodRevenueService.createConfig(data, userId);
    return Response.json({ success: true, data: config });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'CREATE_SOD_REVENUE_CONFIG', entity: 'Admin' }
});

export const PUT = apiHandler(async (_req, _params, body) => {
    const data = updateConfigSchema.parse(body);

    const config = await SodRevenueService.updateConfig(data.id, data);
    return Response.json({ success: true, data: config });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'UPDATE_SOD_REVENUE_CONFIG', entity: 'Admin' }
});

export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Configuration ID required');
    }

    await SodRevenueService.deleteConfig(id);
    return Response.json({ success: true, message: 'Configuration deleted successfully' });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'DELETE_SOD_REVENUE_CONFIG', entity: 'Admin' }
});
