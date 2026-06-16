import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { createStockIssue } from '@/actions/inventory-actions';

// POST: Create Stock Issue
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await createStockIssue(body);

        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
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
