export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';
import { Trip } from '@/types/vehicle-management.types';

/**
 * GET: Retrieve trip details by ID
 */
export const GET = apiHandler<Trip, void>(
    async (_request, params) => {
        const trip = await TripService.getTrip(params.id);

        if (!trip) {
            throw new Error('Trip not found');
        }

        return trip;
    }
);
