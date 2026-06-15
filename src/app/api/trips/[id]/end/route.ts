/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import TripService from '@/services/TripService';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { actual_end_time, actual_distance_km, fuel_consumed_liters } = await request.json();

        // Standardize actual_end_time or default to current date
        const actualEndTime = actual_end_time ? new Date(actual_end_time) : new Date();

        const trip = await TripService.endTrip(
            id,
            actualEndTime,
            actual_distance_km ? parseFloat(actual_distance_km) : undefined,
            fuel_consumed_liters ? parseFloat(fuel_consumed_liters) : undefined
        );

        return NextResponse.json({ success: true, data: trip });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

