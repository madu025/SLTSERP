import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';
import { handleApiError } from '@/lib/api-utils';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, vendorId, title, items } = body;

        if (!projectId || !vendorId || !title || !items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        }

        const po = await InventoryService.generateDraftPO({
            projectId,
            vendorId,
            title,
            items
        });

        return NextResponse.json(po);
    } catch (error) {
        return handleApiError(error);
    }
}
