import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { RevenueRecognitionService } from '@/services/finance/revenue-recognition.service';
import { z } from 'zod';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';

export const dynamic = 'force-dynamic';

// GET /api/finance/revenue-recognition — percentage-of-completion revenue, contract asset / liability per project.
// Project scope is enforced in the service (accessible projects only).
export const GET = apiHandler(async (_req, params) => {
    return RevenueRecognitionService.getReport(params._userId);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

const SetContractValueSchema = z.object({
    projectId: databaseUuidSchema,
    contractValue: z.number().min(0).nullable(),
});

// PUT /api/finance/revenue-recognition — set or clear a project's client contract value.
export const PUT = apiHandler(async (req, params) => {
    const body = SetContractValueSchema.parse(await req.json());
    return RevenueRecognitionService.setContractValue(params._userId, body.projectId, body.contractValue);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_WRITE] });
