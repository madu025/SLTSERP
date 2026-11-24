import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PettyCashService } from '@/services/finance/petty-cash.service';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/ious?accountId=: the IOUs of a site office box (cash released to people)
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const accountId = new URL(req.url).searchParams.get('accountId');
    if (!accountId) throw AppError.badRequest('accountId is required');
    return { data: await PettyCashService.getBoxIous(accountId, params._userId) };
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.PETTY_CASH_SITE] });

const decide = z.object({ id: databaseUuidSchema, action: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().min(3).max(500).optional() }).strict();

// PATCH /api/finance/petty-cash/ious: the Area Manager of the site office approves or rejects the release of cash (the service checks it is that person)
export const PATCH = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'REJECT' && !body.reason) throw AppError.badRequest('A reason is required to reject');
    const data = body.action === 'APPROVE' ? await OSPAccountCrudService.approveIOU(body.id, params._userId) : await OSPAccountCrudService.rejectIOU(body.id, body.reason, params._userId);
    return { message: body.action === 'APPROVE' ? 'Release approved' : 'Release rejected', data };
}, { schema: decide, permissions: [RBAC_PERMISSIONS.PETTY_CASH_SITE, RBAC_PERMISSIONS.FINANCE_APPROVE], audit: { action: 'DECIDE', entity: 'OSP_IOU' } });
