import { NextRequest, NextResponse } from 'next/server';
import { MaterialService } from '@/services/material.service';
import { handleApiError, ApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        if (!['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'OSP_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const { searchParams } = new URL(req.url);
        const contractorId = searchParams.get('contractorId');
        const storeId = searchParams.get('storeId');
        const month = searchParams.get('month');

        if (!contractorId || !storeId || !month) {
            throw new ApiError('Missing parameters', 400);
        }

        const data = await MaterialService.getReconciliation({ contractorId, storeId, month });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const role = req.headers.get('x-user-role');
        const userId = req.headers.get('x-user-id');

        if (!['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'].includes(role || '')) {
            throw new ApiError('Forbidden', 403);
        }

        const body = await req.json();
        const { action, ...data } = body;

        if (action === 'ISSUE') {
            const result = await MaterialService.issueMaterials(data, userId || undefined);
            return NextResponse.json({ success: true, data: result });
        }

        if (action === 'GENERATE_SHEET') {
            const { contractorId, storeId, month } = data;
            const result = await MaterialService.generateBalanceSheet(contractorId, storeId, month, userId || undefined);
            return NextResponse.json({ success: true, data: result });
        }

        throw new ApiError('Invalid action', 400);
    } catch (error) {
        return handleApiError(error);
    }
}
