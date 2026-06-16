
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || '';
        // STORES, OSP, and ADMINS can view in-hand stock
        if (!ROLE_GROUPS.STORES.includes(role) && !ROLE_GROUPS.OPS.includes(role) && !ROLE_GROUPS.ADMINS.includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId') || undefined;
        const itemId = searchParams.get('itemId') || undefined;

        const data = await InventoryService.getInHandStock({ contractorId, itemId });
        return NextResponse.json(data);
    } catch (error) {
        console.error("In-hand stock error:", error);
        return NextResponse.json({ message: 'Error fetching in-hand stock' }, { status: 500 });
    }
}
