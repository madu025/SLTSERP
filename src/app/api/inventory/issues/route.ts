import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// POST: Create Stock Issue
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await InventoryService.createStockIssue(body);
        return NextResponse.json(result);
    } catch (error: any) {
        if (error.message.startsWith('INSUFFICIENT_STOCK')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message === 'MISSING_FIELDS') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        console.error("Error creating stock issue:", error);
        return NextResponse.json({ error: 'Failed to create stock issue', debug: error.message }, { status: 500 });
    }
}

// GET: Fetch Stock Issues
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const issueType = searchParams.get('issueType') || undefined;

        const issues = await InventoryService.getStockIssues({ storeId, issueType });
        return NextResponse.json(issues);
    } catch (error) {
        console.error("Error fetching stock issues:", error);
        return NextResponse.json({ error: "Failed to fetch stock issues" }, { status: 500 });
    }
}
