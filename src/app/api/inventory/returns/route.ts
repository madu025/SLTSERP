import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// POST: Create Material Return
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        const userEmail = request.headers.get('x-user-id');

        if (!role || !['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { materialReturnSchema } = await import('@/lib/validations');

        try {
            const validatedData = materialReturnSchema.parse(body);
            const result = await InventoryService.createMaterialReturn({
                ...validatedData,
                items: validatedData.items.map(i => ({ ...i, quantity: i.quantity.toString() })),
                userId: userEmail || 'System'
            });

            return NextResponse.json({ message: 'Return processed successfully', id: result.id });
        } catch (validationErr: any) {
            return NextResponse.json({ message: validationErr.errors?.[0]?.message || 'Invalid data', errors: validationErr.errors }, { status: 400 });
        }

    } catch (error: any) {
        if (error.message === 'MISSING_FIELDS') {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        console.error('Error processing return:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// GET: Fetch Returns History
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filters = {
            contractorId: searchParams.get('contractorId') || undefined,
            storeId: searchParams.get('storeId') || undefined,
            month: searchParams.get('month') || undefined
        };

        const returns = await InventoryService.getMaterialReturns(filters);
        return NextResponse.json(returns);
    } catch (error) {
        return NextResponse.json({ message: 'Error fetching returns' }, { status: 500 });
    }
}
