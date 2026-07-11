import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';
import { Trip } from '@/types/vehicle-management.types';

/**
 * PATCH: Start a trip
 */
export const PATCH = apiHandler<Trip, void>(
    async (request: Request, params: { id: string }) => {
        const { id } = params;
        let actualStartTime = new Date();

        try {
            const body = await request.json();
            if (body && body.actual_start_time) {
                actualStartTime = new Date(body.actual_start_time);
            }
        } catch {
            // Request body might be empty or invalid, default to now
        }

        const trip = await TripService.startTrip(id, actualStartTime);
        return trip;
    }
);
