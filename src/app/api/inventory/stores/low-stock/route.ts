import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');
        const itemId = searchParams.get('itemId');

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        if (itemId) {
            await InventoryService.checkLowStock(storeId, itemId);
            return NextResponse.json({ success: true, message: 'Checked low stock for item.' });
        } else {
            // Trigger check for all items in the store
            const stocks = await prisma.inventoryStock.findMany({
                where: { storeId }
            });
            for (const stock of stocks) {
                await InventoryService.checkLowStock(storeId, stock.itemId);
            }
            return NextResponse.json({ success: true, message: `Triggered low stock checks for ${stocks.length} items.` });
        }
    } catch (error: unknown) {
        console.error('Error checking low stock:', error);
        return NextResponse.json({ error: 'Failed to check low stock' }, { status: 500 });
    }
}
