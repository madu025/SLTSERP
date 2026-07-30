import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { z } from 'zod';
import { ROLE_GROUPS } from '@/config/roles';

const createLevelSchema = z.object({
  requiredRole: z.string().min(1, "Required Role is required"),
  specificUserId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  minAmount: z.number().optional().nullable(),
  maxAmount: z.number().optional().nullable(),
});

export const POST = apiHandler(async (req, params, body) => {
    const gateId = params?.id as string;
    if (!gateId) throw new Error('Gate ID is required');

    const parsedBody = createLevelSchema.parse(body);
    
    // Cast nulls to undefined to match service signature
    const data = {
      requiredRole: parsedBody.requiredRole,
      specificUserId: parsedBody.specificUserId ?? undefined,
      description: parsedBody.description ?? undefined,
      minAmount: parsedBody.minAmount ?? undefined,
      maxAmount: parsedBody.maxAmount ?? undefined,
    };

    const newLevel = await ProcessGateAdminService.addApprovalLevel(gateId, data);
    
    return {
      status: 201,
      message: 'Approval Level added successfully',
      data: newLevel
    };
}, { roles: ROLE_GROUPS.ADMINS, schema: createLevelSchema });
