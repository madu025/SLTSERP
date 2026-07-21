import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod.service';

// This endpoint allows admins to manually trigger the sync process
export const POST = apiHandler(async () => {
    // Note: This runs in the API route context (Serverless or ongoing process)
    // Since we are deploying on Vercel, this is subject to serverless function timeout limits
    // (10s limit on Hobby tier, 15-300s+ on Pro tier). For large datasets, this sync should be
    // triggered asynchronously or optimized to run in smaller chunks.

    const result = await ServiceOrderService.syncAllOpmcs();

    return Response.json({
        success: true,
        message: 'Manual sync completed',
        stats: result.stats
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'TRIGGER_MANUAL_SYNC', entity: 'Admin' }
});
