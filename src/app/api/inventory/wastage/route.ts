import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { handleApiError, ApiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        const userId = req.headers.get('x-user-id');

        if (!['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { wastageSchema } = await import('@/lib/validations');

        try {
            const validatedData = wastageSchema.parse(body);
            const result = await InventoryService.recordWastage({
                ...validatedData,
                items: validatedData.items.map(i => ({ ...i, quantity: i.quantity.toString() })),
                userId: userId || undefined
            });

            return NextResponse.json({ success: true, data: result });
        } catch (validationErr: any) {
            return NextResponse.json({ success: false, message: validationErr.errors?.[0]?.message || 'Invalid data', errors: validationErr.errors }, { status: 400 });
        }
    } catch (error) {
        return handleApiError(error);
    }
}
