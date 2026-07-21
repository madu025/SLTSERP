import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const execute = searchParams.get('execute') === 'true';

    const result = await ServiceOrderService.fixDates(execute);

    return Response.json(result);
});
