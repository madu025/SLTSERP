import { NextResponse } from 'next/server';
import { MaterialService } from '@/services/material.service';

// GET - Retrieve contractor balance sheet
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month'); // Format: "2025-01"

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        const balanceSheet = await MaterialService.getBalanceSheet(contractorId, storeId, month);

        return NextResponse.json(balanceSheet);
    } catch (error) {
        console.error('Error fetching balance sheet:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
