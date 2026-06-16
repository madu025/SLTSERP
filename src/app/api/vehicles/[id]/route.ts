/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import VehicleService from '@/services/VehicleService';
import { VehicleStatusEnum } from '@prisma/client';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const vehicle = await VehicleService.getVehicle(id);
        if (!vehicle) {
            return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: vehicle });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, assigned_site_id, current_driver_id } = body;

        const data: any = {};
        if (status) data.status = status as VehicleStatusEnum;
        if (assigned_site_id) data.assigned_site_id = assigned_site_id;
        if (current_driver_id !== undefined) data.current_driver_id = current_driver_id;

        const vehicle = await VehicleService.updateVehicle(id, data);

        return NextResponse.json({ success: true, data: vehicle });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await VehicleService.deleteVehicle(id);
        return NextResponse.json({ success: true, data: { message: 'Vehicle deleted' } });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

