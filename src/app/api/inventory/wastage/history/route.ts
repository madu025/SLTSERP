
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || '';
        // STORES, OSP, and ADMINS can view wastage history
        if (!ROLE_GROUPS.STORES.includes(role) && !ROLE_GROUPS.OPS.includes(role) && !ROLE_GROUPS.ADMINS.includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const contractorId = searchParams.get('contractorId') || undefined;
        const month = searchParams.get('month') || undefined;

        const data = await InventoryService.getWastageHistory({ storeId, contractorId, month });
        return NextResponse.json(data);
    } catch (error) {
        console.error("Wastage history error:", error);
        return NextResponse.json({ message: 'Error fetching wastage history' }, { status: 500 });
    }
}
