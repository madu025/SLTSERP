import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { PettyCashService } from '@/services/finance/petty-cash.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/petty-cash/custodians?accountId=: who looks after the box, and who works at the site office (to choose from)
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const accountId = new URL(req.url).searchParams.get('accountId');
    if (!accountId) throw AppError.badRequest('accountId is required');
    return { data: await PettyCashService.getCustodians(accountId, params._userId) };
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.PETTY_CASH_SITE] });

const putSchema = z.object({ accountId: databaseUuidSchema, userIds: z.array(databaseUuidSchema).max(10) }).strict();

// PUT /api/finance/petty-cash/custodians: set who looks after the box (the finance approver)
export const PUT = apiHandler(async (_req, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return { message: 'Custodians saved', data: await PettyCashService.setCustodians(body.accountId, body.userIds, params._userId) };
}, { schema: putSchema, permissions: [RBAC_PERMISSIONS.FINANCE_APPROVE], audit: { action: 'SET', entity: 'PETTY_CASH_CUSTODIANS' } });
