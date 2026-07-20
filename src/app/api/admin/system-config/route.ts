import { SystemConfigService } from '@/services/system-config.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async () => {
    return SystemConfigService.getConfigs();
}, { rawResponse: true });

export const POST = apiHandler(async (request) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Only Super Admins can modify system config');
    }

    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
        throw AppError.badRequest('Key and Value required');
    }

    return SystemConfigService.updateConfig(key, value, description, userId || 'system');
}, { rawResponse: true });
