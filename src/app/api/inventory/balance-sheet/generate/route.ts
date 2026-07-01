import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, storeId, month } = body; // month in "YYYY-MM" format

        if (!contractorId || !storeId || !month) {
            return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
        }

        const reportData = await InventoryService.generateReportData({
            contractorId,
            storeId,
            month
        });

        return NextResponse.json({
            month,
            contractorId,
            storeId,
            items: reportData
        });

    } catch (error) {
        console.error('Error generating balance sheet:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
