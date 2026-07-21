import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const resetSchema = z.object({
    confirmText: z.string()
});

/**
 * POST /api/admin/system/reset-sods
 * ⚠️ CRITICAL: Clears all Service Order related data to reset the system.
 */
export const POST = apiHandler(async (_req, _params, body) => {
    const { confirmText } = resetSchema.parse(body);

    // Force a confirmation string to prevent accidental resets
    if (confirmText !== 'RESET_ALL') {
        throw AppError.badRequest('Invalid confirmation text');
    }

    console.log('[SYSTEM-RESET] Starting full Service Order data reset...');
    
    await AdminSystemService.resetSystemData();

    return Response.json({
        message: 'All service order data has been successfully cleared. System is ready for fresh start.',
        timestamp: new Date().toISOString()
    });
}, {
    roles: ['SUPER_ADMIN'],
    audit: { action: 'RESET_SYSTEM_DATA', entity: 'Admin' }
});
