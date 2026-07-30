import { apiHandler } from '@/lib/api-handler';
import VehicleService from '@/services/fleet/VehicleService';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const location = await VehicleService.getVehicleLocation(params.id);

    if (!location) {
        throw AppError.notFound('Location not found');
    }

    return location;
});

export const POST = apiHandler(async (_request, params, body) => {
    const latitude = body.latitude as number | undefined;
    const longitude = body.longitude as number | undefined;
    const speed_kmh = body.speed_kmh as number | undefined;
    const heading = body.heading as number | undefined;

    if (!latitude || !longitude) {
        throw AppError.badRequest('Missing latitude, longitude');
    }

    const vehicle = await VehicleService.updateVehicleLocation(params.id, latitude, longitude, speed_kmh, heading);
    return vehicle;
}, {
    audit: { action: 'LOCATION_UPDATE', entity: 'Vehicle' }
});
