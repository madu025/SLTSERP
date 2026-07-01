import { NextResponse } from 'next/server';
import { MaterialService } from '@/services/material.service';

// GET - Preview balance sheet data before generation
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month');

        if (!contractorId || !storeId || !month) {
            return NextResponse.json(
                { error: 'contractorId, storeId, and month are required' },
                { status: 400 }
            );
        }

        const previewData = await MaterialService.previewBalanceSheet(contractorId, storeId, month);

        return NextResponse.json(previewData);
    } catch (error) {
        console.error('Error fetching preview:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
