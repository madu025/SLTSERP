import { apiHandler } from '@/lib/api-handler';
import TripService from '@/services/TripService';
import { TripStatusEnum } from '@prisma/client';
import { createTripSchema, CreateTripSchema } from '@/lib/validations/trip.schema';
import { Trip } from '@/types/vehicle-management.types';

/**
 * GET: List trips with filters
 */
export const GET = apiHandler<Trip[], void>(
    async (request: Request) => {
        const { searchParams } = new URL(request.url);
        const vehicle_id = searchParams.get('vehicle_id');
        const driver_id = searchParams.get('driver_id');
        const trip_status = searchParams.get('trip_status');
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: {
            vehicle_id?: string;
            driver_id?: string;
            trip_status?: TripStatusEnum;
            from_date?: Date;
            to_date?: Date;
            page?: number;
            limit?: number;
        } = {};
        if (vehicle_id) filters.vehicle_id = vehicle_id;
        if (driver_id) filters.driver_id = driver_id;
        if (trip_status) filters.trip_status = trip_status as TripStatusEnum;
        if (from_date) filters.from_date = new Date(from_date);
        if (to_date) filters.to_date = new Date(to_date);
        filters.page = page;
        filters.limit = limit;

        const { data } = await TripService.listTrips(filters);
        return data;
    }
);

/**
 * POST: Create a new trip
 */
export const POST = apiHandler<Trip, CreateTripSchema>(
    async (request: Request, params: unknown, body) => {
        const trip = await TripService.createTrip({
            vehicle_id: body.vehicle_id,
            driver_id: body.driver_id,
            start_location: body.start_location,
            end_location: body.end_location,
            scheduled_start_time: new Date(body.scheduled_start_time),
            scheduled_end_time: new Date(body.scheduled_end_time),
            trip_type: body.trip_type,
        });

        return trip;
    },
    { schema: createTripSchema }
);
