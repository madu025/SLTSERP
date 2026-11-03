import { apiHandler } from '@/lib/api-handler';
import { TaxConfigService } from '@/services/finance/tax-config.service';
import { AppError } from '@/lib/error';
import { TaxTypeEnum } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const taxNumber = z.union([
    z.number().finite().min(0).max(100),
    z.string().trim().min(1).max(20).refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100, 'Tax rate must be between 0 and 100'),
]);
const createTaxConfigSchema = z.object({
    tax_name: z.string().trim().min(1).max(200),
    tax_type: z.nativeEnum(TaxTypeEnum),
    tax_rate_percent: taxNumber,
    effective_from_date: z.string().trim().min(1).max(40),
    effective_to_date: z.string().trim().max(40).optional().nullable(),
    applicable_to: z.union([z.record(z.string(), z.unknown()), z.string()]).optional().nullable(),
    tax_inclusive: z.boolean().optional(),
    tax_exempt_items: z.string().trim().max(5000).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();
type CreateTaxConfigRequest = z.infer<typeof createTaxConfigSchema>;

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';

    const taxConfigs = await TaxConfigService.getTaxConfigs(status);
    return taxConfigs;
});

export const POST = apiHandler<unknown, CreateTaxConfigRequest>(async (_request, _params, body) => {
    try {
        const taxConfig = await TaxConfigService.createTaxConfig(body);
        return taxConfig;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : undefined;
        if (message === 'MISSING_REQUIRED_FIELDS') {
            throw AppError.badRequest('Missing required fields: tax_name, tax_type, tax_rate_percent, effective_from_date');
        }
        if (message === 'INVALID_TAX_TYPE') {
            throw AppError.badRequest('Invalid tax_type. Must be one of: ' + Object.values(TaxTypeEnum).join(', '));
        }
        throw error;
    }
}, {
    schema: createTaxConfigSchema,
    audit: { action: 'TAX_CONFIG_CREATE', entity: 'TaxConfig' }
});
