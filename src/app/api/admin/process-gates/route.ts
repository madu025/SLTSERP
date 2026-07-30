import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { z } from 'zod';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

const createGateSchema = z.object({
  entityType: z.string().min(1, "Entity Type is required"),
  fromStatus: z.string().min(1, "From Status is required"),
  toStatus: z.string().min(1, "To Status is required"),
  label: z.string().min(1, "Label is required"),
  isEnabled: z.boolean().optional(),
  reqOpmcPat: z.boolean().optional(),
  reqHoPat: z.boolean().optional(),
  reqSltsPat: z.boolean().optional(),
  reqPhotoProof: z.boolean().optional(),
  reqGpsLocation: z.boolean().optional(),
  reqDocUpload: z.boolean().optional(),
  writeAuditLedger: z.boolean().optional(),
  generateIssueNote: z.boolean().optional(),
});

export const GET = apiHandler(async () => {
    const gates = await ProcessGateAdminService.getAllGates();
    return { data: gates };
}, { roles: ROLE_GROUPS.ADMINS });

export const POST = apiHandler(async (req, params, body) => {
    const newGate = await ProcessGateAdminService.createGate(body);
    
    return {
      status: 201,
      message: 'Process Gate Policy created successfully',
      data: newGate
    };
}, { roles: ROLE_GROUPS.ADMINS, schema: createGateSchema });
