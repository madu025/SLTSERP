import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { serviceOrderCreateSchema, serviceOrderPatchSchema, serviceOrderUpdateSchema } from '@/lib/validations/service-order.schema';

// GET service orders with pagination and summary metrics
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const params = {
            rtomId: searchParams.get('rtomId') || searchParams.get('opmcId') || '',
            filter: searchParams.get('filter') || 'pending',
            search: searchParams.get('search') || undefined,
            statusFilter: searchParams.get('statusFilter') || undefined,
            patFilter: searchParams.get('patFilter') || undefined,
            matFilter: searchParams.get('matFilter') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            limit: parseInt(searchParams.get('limit') || '50'),
            cursor: searchParams.get('cursor') || undefined,
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
        };

        if (!params.rtomId) {
            return NextResponse.json({ message: 'RTOM selection is required' }, { status: 400 });
        }

        const result = await ServiceOrderService.getServiceOrders(params);
        return NextResponse.json(result);

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error fetching service orders:', error);
        return NextResponse.json({ message: 'Error fetching service orders', debug: msg }, { status: 500 });
    }
}

// POST - Create manual service order
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = serviceOrderCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Validation failed', errors: validation.error.format() }, { status: 400 });
        }

        const serviceOrder = await ServiceOrderService.createServiceOrder(validation.data);
        return NextResponse.json(serviceOrder);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error creating service order:', error);
        return NextResponse.json({ message: 'Error creating service order', debug: msg }, { status: 500 });
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
        const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData as any, userId);
        return NextResponse.json(serviceOrder);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === 'ID_REQUIRED') {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }
        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order', debug: msg }, { status: 500 });
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

        const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData as any, userId);
        return NextResponse.json(serviceOrder);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === 'ID_REQUIRED') {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }
        if (msg === 'INVALID_STATUS') {
            return NextResponse.json({ message: 'Invalid SLTS Status' }, { status: 400 });
        }
        if (msg === 'COMPLETED_DATE_REQUIRED') {
            return NextResponse.json({ message: 'Completed date is required for COMPLETED or RETURN status' }, { status: 400 });
        }

        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order', debug: msg }, { status: 500 });
    }
}
