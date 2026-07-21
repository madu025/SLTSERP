import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (req) => {
    // Basic Security: Check for CRON_SECRET or specific test secret
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized');
    }

    const soNum = searchParams.get('soNum') || 'HAV202607170008702';

    const so = await ServiceOrderService.debugSync(soNum);

    return Response.json({ success: true, so });
});
