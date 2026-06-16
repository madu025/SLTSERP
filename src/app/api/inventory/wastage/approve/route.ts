
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';

export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role') || '';
        const userId = request.headers.get('x-user-id') || '';

        // Only OSP_MANAGER, ADMINS can approve wastage
        if (!ROLE_GROUPS.ADMINS.includes(role) && role !== 'OSP_MANAGER') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await request.json();
        if (!id) return NextResponse.json({ message: 'Missing ID' }, { status: 400 });

        const result = await InventoryService.approveWastage(id, userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Wastage approval error:", error);
        return NextResponse.json({ message: 'Error approving wastage' }, { status: 500 });
    }
}
