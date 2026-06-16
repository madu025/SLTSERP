/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import TripService from '@/services/TripService';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        let actualStartTime = new Date();

        try {
            const body = await request.json();
            if (body && body.actual_start_time) {
                actualStartTime = new Date(body.actual_start_time);
            }
        } catch (e) {
            // Request body might be empty or invalid, default to now
        }

        const trip = await TripService.startTrip(id, actualStartTime);

        return NextResponse.json({ success: true, data: trip });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

