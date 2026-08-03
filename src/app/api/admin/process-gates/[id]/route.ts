export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { z } from 'zod';
import { ROLE_GROUPS } from '@/config/roles';

const updateGateSchema = z.object({
  label: z.string().optional(),
  isEnabled: z.boolean().optional(),
  reqOpmcPat: z.boolean().optional(),
  reqHoPat: z.boolean().optional(),
  reqSltsPat: z.boolean().optional(),
  reqPhotoProof: z.boolean().optional(),
  reqGpsLocation: z.boolean().optional(),
  reqDocUpload: z.boolean().optional(),
  writeAuditLedger: z.boolean().optional(),
  generateIssueNote: z.boolean().optional(),
  // Zero-Coding webhook mapping from the Domain Action registry
  domainAction: z.string().max(200).optional().nullable(),
});

export const PUT = apiHandler(async (req, params, body) => {
    const id = params?.id as string;
    if (!id) throw new Error('ID is required');

    const updatedGate = await ProcessGateAdminService.updateGate(id, body);
    
    return {
      message: 'Process Gate Policy updated successfully',
      data: updatedGate
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS, schema: updateGateSchema });

export const DELETE = apiHandler(async (req, params) => {
    const id = params?.id as string;
    if (!id) throw new Error('ID is required');

    await ProcessGateAdminService.deleteGate(id);
    
    return {
      message: 'Process Gate Policy deleted successfully',
      id,
      data: { id, success: true }
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS });
