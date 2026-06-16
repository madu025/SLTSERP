/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import VehicleService from '@/services/VehicleService';
import { VehicleStatusEnum, OwnershipTypeEnum } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const site_id = searchParams.get('site_id');
        const status = searchParams.get('status');
        const ownership = searchParams.get('ownership');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: any = {};
        if (site_id) filters.site_id = site_id;
        if (status) filters.status = status as VehicleStatusEnum;
        if (ownership) filters.ownership = ownership as OwnershipTypeEnum;
        filters.page = page;
        filters.limit = limit;

        const { data, total } = await VehicleService.listVehicles(filters);

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
        const { registration_number, chassis_number, assigned_site_id } = body;

        if (!registration_number || !chassis_number || !assigned_site_id) {
            return NextResponse.json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: registration_number, chassis_number, assigned_site_id' },
            }, { status: 400 });
        }

        const vehicle = await VehicleService.createVehicle(body);

        return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } }, { status: 500 });
    }
}

