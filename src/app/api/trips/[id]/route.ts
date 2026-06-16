/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import TripService from '@/services/TripService';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const trip = await TripService.getTrip(id);

        if (!trip) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: trip });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

