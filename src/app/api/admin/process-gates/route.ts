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
  // Zero-Coding webhook mapping from the Domain Action registry
  domainAction: z.string().max(200).optional().nullable(),
});

export const GET = apiHandler(async () => {
    const gates = await ProcessGateAdminService.getAllGates();
    return gates;
}, { roles: ROLE_GROUPS.ADMINS });

// Gate policy configuration is privilege-granting (defines approval authority),
// so mutations are restricted to SUPER_ADMIN/ADMIN only.
export const POST = apiHandler(async (_req, _params, body) => {
    const newGate = await ProcessGateAdminService.createGate(body);

    return {
      message: 'Process Gate Policy created successfully',
      data: newGate
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS, schema: createGateSchema });
