/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import VehicleService from '@/services/VehicleService';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const from_date = searchParams.get('from_date');
        const to_date = searchParams.get('to_date');

        if (!from_date || !to_date) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing from_date or to_date' } }, { status: 400 });
        }

        const fromDate = new Date(from_date);
        const toDate = new Date(to_date);

        const data = await VehicleService.getVehicleUtilization(id, fromDate, toDate);

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

