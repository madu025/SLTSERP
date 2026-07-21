import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (req, params) => {
    const { id: driverId } = await params;
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
        throw AppError.badRequest('Missing date query param (YYYY-MM-DD)');
    }

    const date = new Date(dateStr + 'T00:00:00.000Z');
    const trips = await TripService.getDriverDailyTrips(driverId, date);

    return trips; // apiHandler will wrap in success: true, data: trips
}, {
    // Requires standard auth
});
