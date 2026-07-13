import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'ALL';
        const rtom = searchParams.get('rtom') || 'ALL';
        const region = searchParams.get('region') || 'ALL';
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;

        const result = await ServiceOrderService.getPatResults({
            page,
            limit,
            search,
            status,
            rtom,
            region,
            startDate,
            endDate
        });

        return NextResponse.json(result);
    } catch (error) {
        return handleApiError(error);
    }
}
