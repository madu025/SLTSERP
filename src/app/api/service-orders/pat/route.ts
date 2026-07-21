import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const rtom = searchParams.get('rtom') || 'ALL';
    const region = searchParams.get('region') || 'ALL';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    return await ServiceOrderService.getPatResults({
        page,
        limit,
        search,
        status,
        rtom,
        region,
        startDate,
        endDate
    });
}, { rawResponse: true });
