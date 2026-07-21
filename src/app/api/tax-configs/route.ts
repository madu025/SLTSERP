import { apiHandler } from '@/lib/api-handler';
import { TaxConfigService } from '@/services/tax-config.service';
import { AppError } from '@/lib/error';
import { TaxTypeEnum } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';

    const taxConfigs = await TaxConfigService.getTaxConfigs(status);
    return taxConfigs;
});

export const POST = apiHandler(async (_request, _params, body) => {
    try {
        const taxConfig = await TaxConfigService.createTaxConfig(body);
        return taxConfig;
    } catch (error: any) {
        const message = error?.message;
        if (message === 'MISSING_REQUIRED_FIELDS') {
            throw AppError.badRequest('Missing required fields: tax_name, tax_type, tax_rate_percent, effective_from_date');
        }
        if (message === 'INVALID_TAX_TYPE') {
            throw AppError.badRequest('Invalid tax_type. Must be one of: ' + Object.values(TaxTypeEnum).join(', '));
        }
        throw error;
    }
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'TAX_CONFIG_CREATE', entity: 'TaxConfig' }
});
