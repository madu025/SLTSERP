
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || '';
        if (!ROLE_GROUPS.STORES.includes(role) && !ROLE_GROUPS.ADMINS.includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const data = await InventoryService.getTransitionPreview();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Transition preview error:", error);
        return NextResponse.json({ message: 'Error fetching preview' }, { status: 500 });
    }
}
