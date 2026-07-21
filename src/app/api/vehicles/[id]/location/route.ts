import { apiHandler } from '@/lib/api-handler';
import VehicleService from '@/services/VehicleService';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id } = await params;
    const location = await VehicleService.getVehicleLocation(id);

    if (!location) {
        throw AppError.notFound('Location not found');
    }

    return location;
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id } = await params;
    const { latitude, longitude, speed_kmh, heading } = body || {};

    if (!latitude || !longitude) {
        throw AppError.badRequest('Missing latitude, longitude');
    }

    const vehicle = await VehicleService.updateVehicleLocation(id, latitude, longitude, speed_kmh, heading);
    return vehicle;
}, {
    audit: { action: 'LOCATION_UPDATE', entity: 'Vehicle' }
});
