import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { serviceOrderPatchSchema, serviceOrderUpdateSchema } from '@/lib/validations/service-order.schema';
import { z } from 'zod';

// GET service orders with pagination and summary metrics
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const params = {
            opmcId: searchParams.get('opmcId') || '',
            filter: searchParams.get('filter') || 'pending',
            search: searchParams.get('search') || undefined,
            statusFilter: searchParams.get('statusFilter') || undefined,
            patFilter: searchParams.get('patFilter') || undefined,
            matFilter: searchParams.get('matFilter') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            limit: parseInt(searchParams.get('limit') || '50'),
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
        };

        if (!params.opmcId) {
            return NextResponse.json({ message: 'RTOM ID required' }, { status: 400 });
        }

        const result = await ServiceOrderService.getServiceOrders(params);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error fetching service orders:', error);
        return NextResponse.json({ message: 'Error fetching service orders', debug: error.message }, { status: 500 });
    }
}

// POST - Manual service order entry
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const serviceOrder = await ServiceOrderService.createServiceOrder(body);
        return NextResponse.json(serviceOrder);
    } catch (error: any) {
        if (error.message === 'REQUIRED_FIELDS_MISSING') {
            return NextResponse.json({ message: 'RTOM ID, SO Number, and Status are required' }, { status: 400 });
        }
        if (error.message === 'ORDER_EXISTS') {
            return NextResponse.json({ message: 'Service order with this SO Number and Status already exists' }, { status: 409 });
        }
        console.error('Error creating service order:', error);
        return NextResponse.json({ message: 'Error creating service order', debug: error.message }, { status: 500 });
    }
}

// PUT - Update service order
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        // Zod Validation
        const validation = serviceOrderUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Validation failed', errors: validation.error.format() }, { status: 400 });
        }

        const { id, ...updateData } = validation.data;
        const userId = request.headers.get('x-user-id') || undefined;
        const serviceOrder = await ServiceOrderService.updateServiceOrder(id, updateData, userId);
        return NextResponse.json(serviceOrder);
    } catch (error: any) {
        if (error.message === 'ID_REQUIRED') {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }
        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order', debug: error.message }, { status: 500 });
    }
}

// PATCH - Update SLTS Status query or Contractor assignment
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        // Zod Validation
        const validation = serviceOrderPatchSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Validation failed', errors: validation.error.format() }, { status: 400 });
        }

        const { id, ...updateData } = validation.data;
        const userId = request.headers.get('x-user-id') || undefined;

        const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData, userId);
        return NextResponse.json(serviceOrder);
    } catch (error: any) {
        if (error.message === 'ID_REQUIRED') {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }
        if (error.message === 'INVALID_STATUS') {
            return NextResponse.json({ message: 'Invalid SLTS Status' }, { status: 400 });
        }
        if (error.message === 'COMPLETED_DATE_REQUIRED') {
            return NextResponse.json({ message: 'Completed date is required for COMPLETED or RETURN status' }, { status: 400 });
        }

        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order', debug: error.message }, { status: 500 });
    }
}
