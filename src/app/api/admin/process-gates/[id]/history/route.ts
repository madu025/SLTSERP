export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProcessGateAdminService } from '@/services/admin/process-gate.service';

// GET /api/admin/process-gates/[id]/history - who changed the gate and when, in words
export const GET = apiHandler(async (_req, params) => {
    const id = params?.id as string;
    if (!id) throw AppError.badRequest('ID is required');
    return ProcessGateAdminService.history(id);
});
