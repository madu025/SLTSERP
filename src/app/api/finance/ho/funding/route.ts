import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { HoFundingService } from '@/services/finance/ho-funding.service';

export const dynamic = 'force-dynamic';

const create = z.object({
    action: z.literal('CREATE'), purpose: z.enum(['PAYMENTS', 'PETTY_CASH_FLOAT']), requestedAmount: z.number().positive(),
    periodFrom: z.string().nullish(), periodTo: z.string().nullish(), pettyCashAccountId: databaseUuidSchema.nullish(), remarks: z.string().max(500).nullish(),
});
const simple = z.object({ action: z.enum(['SUBMIT', 'CANCEL']), id: databaseUuidSchema });
const approve = z.object({ action: z.literal('APPROVE'), id: databaseUuidSchema, approvedAmount: z.number().positive() });
const reject = z.object({ action: z.literal('REJECT'), id: databaseUuidSchema, reason: z.string().min(3).max(500) });
const fund = z.object({ action: z.literal('FUND'), id: databaseUuidSchema, hoReference: z.string().min(1).max(120), fundedDate: z.string().min(8), fundedAmount: z.number().positive().optional() });
const bodySchema = z.discriminatedUnion('action', [create, simple, approve, reject, fund]);

// GET /api/finance/ho/funding?status=  |  ?position=1  |  ?suggest=YYYY-MM-DD
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    if (sp.get('position')) return HoFundingService.position(params._userId ?? '');
    const suggest = sp.get('suggest');
    if (suggest) return HoFundingService.suggest(params._userId ?? '', new Date(suggest));
    return HoFundingService.list(sp.get('status') || undefined);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/ho/funding  { action: CREATE | SUBMIT | CANCEL | APPROVE | REJECT | FUND, ... }
// OSP Finance asks (finance.ho.submit); Head Office approves and funds (finance.ho.confirm).
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const headOffice = ['APPROVE', 'REJECT', 'FUND'].includes(body.action);
    if (!(await userHasPermission(userId, headOffice ? RBAC_PERMISSIONS.FINANCE_HO_CONFIRM : RBAC_PERMISSIONS.FINANCE_HO_SUBMIT))) {
        throw AppError.forbidden(`${headOffice ? 'finance.ho.confirm' : 'finance.ho.submit'} is required for this action`);
    }
    switch (body.action) {
        case 'CREATE': return HoFundingService.create(userId, body);
        case 'SUBMIT': return HoFundingService.submit(body.id, userId);
        case 'CANCEL': return HoFundingService.cancel(body.id, userId);
        case 'APPROVE': return HoFundingService.approve(body.id, userId, body.approvedAmount);
        case 'REJECT': return HoFundingService.reject(body.id, userId, body.reason);
        case 'FUND': return HoFundingService.fund(body.id, userId, body);
    }
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_HO_SUBMIT, RBAC_PERMISSIONS.FINANCE_HO_CONFIRM], audit: { action: 'HO_FUNDING_ACTION', entity: 'HO_FUNDING_REQUEST', entityIdParam: 'id' } });
