import { ROLE_GROUPS } from '@/config/roles';
import VehicleService from '@/services/fleet/VehicleService';
import { VehicleStatusEnum } from '@prisma/client';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const vehicle = await VehicleService.getVehicle(id);
    if (!vehicle) {
        throw AppError.notFound('Vehicle not found');
    }
    return vehicle;
});

export const PUT = apiHandler(async (request, params, body) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const { status, assigned_site_id, current_driver_id } = body;

    const data: Record<string, unknown> = {};
    if (status) data.status = status as VehicleStatusEnum;
    if (assigned_site_id) data.assigned_site_id = assigned_site_id;
    if (current_driver_id !== undefined) data.current_driver_id = current_driver_id;

    return await VehicleService.updateVehicle(id, data);
}, {
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: { action: 'UPDATE', entity: 'VEHICLE' }
});

export const DELETE = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    await VehicleService.deleteVehicle(id);
    return { message: 'Vehicle deleted' };
}, {
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: { action: 'DELETE', entity: 'VEHICLE' }
});

