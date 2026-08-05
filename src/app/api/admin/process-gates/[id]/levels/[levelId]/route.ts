export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';

export const DELETE = apiHandler(async (req, params) => {
    const gateId = params?.id as string;
    const levelId = params?.levelId as string;
    
    if (!gateId || !levelId) {
      throw AppError.badRequest('Gate ID and Level ID are required');
    }

    await ProcessGateAdminService.deleteApprovalLevel(gateId, levelId);
    
    return {
      message: 'Approval Level deleted successfully',
      data: { success: true }
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS });
