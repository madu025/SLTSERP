export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';
import { z } from 'zod';
import { ROLE_GROUPS } from '@/config/roles';
import { AppError } from '@/lib/error';

// specificUserId targets a @db.Uuid FK — validate format to avoid P2023 runtime errors
const levelSchema = z.object({
  requiredRole: z.string().min(1, "Required Role is required"),
  specificUserId: z.string().uuid('specificUserId must be a valid UUID').optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  minAmount: z.number().nonnegative().optional().nullable(),
  maxAmount: z.number().nonnegative().optional().nullable(),
});

const createLevelSchema = levelSchema;

const replaceLevelsSchema = z.object({
  levels: z.array(levelSchema).min(1, 'At least one approval level is required').max(10),
});

export const POST = apiHandler(async (req, params, body) => {
    const gateId = params?.id as string;
    if (!gateId) throw AppError.badRequest('Gate ID is required');

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
      message: 'Approval Level added successfully',
      data: newLevel
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS, schema: createLevelSchema, audit: { action: 'CREATE', entity: 'PROCESS_GATE_LEVEL' } });

// Bulk replace ALL levels of a gate (wizard save path) — atomic delete + renumber
export const PUT = apiHandler(async (req, params, body) => {
    const gateId = params?.id as string;
    if (!gateId) throw AppError.badRequest('Gate ID is required');

    const parsed = replaceLevelsSchema.parse(body);
    const result = await ProcessGateAdminService.replaceApprovalLevels(gateId, parsed.levels);

    return {
      message: 'Approval Levels updated successfully',
      data: result
    };
}, { roles: ROLE_GROUPS.CORE_ADMINS, schema: replaceLevelsSchema, audit: { action: 'REPLACE_LEVELS', entity: 'PROCESS_GATE_LEVEL' } });
