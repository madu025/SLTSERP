/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import VehicleService from '@/services/VehicleService';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const location = await VehicleService.getVehicleLocation(id);
        if (!location) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Location not found' } }, { status: 404 });
        }
        return NextResponse.json({
            success: true,
            data: location,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { latitude, longitude, speed_kmh, heading } = await request.json();

        if (!latitude || !longitude) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing latitude, longitude' } }, { status: 400 });
        }

        const vehicle = await VehicleService.updateVehicleLocation(id, latitude, longitude, speed_kmh, heading);

        return NextResponse.json({ success: true, data: vehicle });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

