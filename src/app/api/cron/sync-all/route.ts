import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';
import { AppError } from '@/lib/error';

/**
 * Scheduled Sync for all Service Orders from SLT API
 * Can be triggered by a Cron Job service (e.g., Vercel Cron, GitHub Actions)
 */
export const GET = apiHandler(async (req) => {
    // Basic Security: Check for Cron Secret if configured
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    console.log('[CRON] Starting Global SOD Sync...');
    
    const startTime = Date.now();
    const results = await ServiceOrderService.syncAllOpmcs();
    const duration = (Date.now() - startTime) / 1000;

    console.log(`[CRON] Global SOD Sync completed in ${duration}s`, results.stats);

    return Response.json({
        success: true,
        message: 'Global sync completed',
        duration: `${duration}s`,
        stats: results.stats
    });
});
