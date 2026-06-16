/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import TripService from '@/services/TripService';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: driverId } = await params;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date');

        if (!dateStr) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing date query param (YYYY-MM-DD)' } }, { status: 400 });
        }

        const date = new Date(dateStr + 'T00:00:00.000Z');
        const trips = await TripService.getDriverDailyTrips(driverId, date);

        return NextResponse.json({ success: true, data: trips });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

