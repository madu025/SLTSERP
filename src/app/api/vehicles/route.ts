import VehicleService from '@/services/VehicleService';
import { VehicleStatusEnum, OwnershipTypeEnum } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const site_id = searchParams.get('site_id');
    const status = searchParams.get('status');
    const ownership = searchParams.get('ownership');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const filters: any = {};
    if (site_id) filters.site_id = site_id;
    if (status) filters.status = status as VehicleStatusEnum;
    if (ownership) filters.ownership = ownership as OwnershipTypeEnum;
    filters.page = page;
    filters.limit = limit;

    const { data, total } = await VehicleService.listVehicles(filters);

    return {
        data,
        meta: { total, page, limit, pages: Math.ceil(total / limit) }
    };
});

export const POST = apiHandler(async (request, _params, body) => {
    const { registration_number, chassis_number, assigned_site_id } = body;

    if (!registration_number || !chassis_number || !assigned_site_id) {
        throw AppError.badRequest('Missing required fields: registration_number, chassis_number, assigned_site_id');
    }

    return await VehicleService.createVehicle(body);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN'],
    audit: { action: 'CREATE', entity: 'VEHICLE' }
});

