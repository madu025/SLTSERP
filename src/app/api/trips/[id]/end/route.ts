import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';
import { endTripSchema, EndTripSchema } from '@/lib/validations/trip.schema';
import { Trip } from '@/types/vehicle-management.types';

/**
 * PATCH: End a trip
 */
export const PATCH = apiHandler<Trip, EndTripSchema>(
    async (request: Request, params: { id: string }, body) => {
        const { id } = params;

        // Standardize actual_end_time or default to current date
        const actualEndTime = body.actual_end_time ? new Date(body.actual_end_time) : new Date();

        const trip = await TripService.endTrip(
            id,
            actualEndTime,
            body.actual_distance_km !== undefined && body.actual_distance_km !== null ? Number(body.actual_distance_km) : undefined,
            body.fuel_consumed_liters !== undefined && body.fuel_consumed_liters !== null ? Number(body.fuel_consumed_liters) : undefined
        );

        return trip;
    },
    { schema: endTripSchema }
);
