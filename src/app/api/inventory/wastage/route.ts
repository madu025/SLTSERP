import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import { recordWastage } from '@/actions/inventory-actions';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = await recordWastage(body);

        if (result.success) {
            return NextResponse.json({ success: true, data: result.data });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
    } catch (error) {
        return handleApiError(error);
    }
}
