export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/fleet/TripService';
import { Trip } from '@/types/fleet/trip.types';

/**
 * PATCH: Start a trip
 */
export const PATCH = apiHandler<Trip, void>(
    async (request, params) => {
        let actualStartTime = new Date();

        try {
            const body = await request.json();
            if (body && body.actual_start_time) {
                actualStartTime = new Date(body.actual_start_time);
            }
        } catch {
            // Request body might be empty or invalid, default to now
        }

        const trip = await TripService.startTrip(params.id, actualStartTime);
        return trip;
    },
    { roles: ['ALL'] }
);
