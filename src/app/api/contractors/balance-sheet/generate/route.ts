import { NextResponse } from 'next/server';
import { MaterialService } from '@/services/material.service';

// POST - Generate contractor balance sheet for a month
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contractorId, storeId, month } = body;

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        const sheet = await MaterialService.generateBalanceSheet(contractorId, storeId, month);
        const balanceSheet = await MaterialService.getBalanceSheet(contractorId, storeId, month);

        return NextResponse.json({
            message: 'Balance sheet generated successfully',
            balanceSheet
        });
    } catch (error) {
        console.error('Error generating balance sheet:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
