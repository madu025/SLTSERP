/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import TripService from '@/services/TripService';
import { TripStatusEnum } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const vehicle_id = searchParams.get('vehicle_id');
        const driver_id = searchParams.get('driver_id');
        const trip_status = searchParams.get('trip_status');
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: any = {};
        if (vehicle_id) filters.vehicle_id = vehicle_id;
        if (driver_id) filters.driver_id = driver_id;
        if (trip_status) filters.trip_status = trip_status as TripStatusEnum;
        if (from_date) filters.from_date = new Date(from_date);
        if (to_date) filters.to_date = new Date(to_date);
        filters.page = page;
        filters.limit = limit;

        const { data, total } = await TripService.listTrips(filters);

        return NextResponse.json({
            success: true,
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vehicle_id, driver_id, start_location, end_location, scheduled_start_time, scheduled_end_time, trip_type } = body;

        if (!vehicle_id || !driver_id || !start_location || !end_location || !trip_type) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }, { status: 400 });
        }

        const trip = await TripService.createTrip({
            vehicle_id,
            driver_id,
            start_location,
            end_location,
            scheduled_start_time: new Date(scheduled_start_time),
            scheduled_end_time: new Date(scheduled_end_time),
            trip_type,
        });

        return NextResponse.json({ success: true, data: trip }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

