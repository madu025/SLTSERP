import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';

/**
 * POST /api/admin/clear-service-orders
 * Clear all ServiceOrder data (Admin/Super Admin only)
 */
export const POST = apiHandler(async () => {
    const results = await AdminSystemService.clearAllServiceOrders();

    return Response.json({
        success: true,
        message: 'All Service Order data cleared successfully',
        results
    });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'CLEAR_ALL_SERVICE_ORDERS', entity: 'System' }
});
