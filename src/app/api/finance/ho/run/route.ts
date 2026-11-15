import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { userHasPermission } from '@/lib/user-permissions';
import { HoRunService } from '@/services/finance/ho-run.service';
import { PAYMENT_CATEGORIES, type PaymentCategory } from '@/config/payment-categories';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('CREATE'),
        submitForApproval: z.boolean().optional(),
        items: z.array(z.object({
            kind: z.enum(['VENDOR', 'CONTRACTOR', 'SOD']), id: databaseUuidSchema, amount: z.number().finite().positive(),
            taxWithheld: z.number().finite().min(0).optional(), retentionAmount: z.number().finite().min(0).optional(),
        })).min(1).max(100),
    }),
    z.object({ action: z.literal('APPROVE'), voucherIds: z.array(databaseUuidSchema).min(1).max(100) }),
]);

// GET /api/finance/ho/run?category=&month=YYYY-MM  - what can be paid; ?queue=1 - requests waiting for approval / for a pack
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    if (sp.get('queue')) return HoRunService.queue(params._userId ?? '');
    if (sp.get('categories')) return HoRunService.categories();
    const category = sp.get('category') as PaymentCategory | null;
    if (category && !(category in PAYMENT_CATEGORIES)) throw AppError.badRequest('INVALID_CATEGORY');
    return HoRunService.payables(params._userId ?? '', category ?? undefined, sp.get('month') || undefined);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/finance/ho/run - CREATE requests in bulk (finance.write + finance.ho.submit), APPROVE them in bulk (finance.approve)
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    if (body.action === 'CREATE') {
        if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_WRITE)) || !(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_SUBMIT))) {
            throw AppError.forbidden('finance.write and finance.ho.submit are required to create payment requests for Head Office');
        }
        return HoRunService.createRequests(userId, body.items, body.submitForApproval ?? true);
    }
    if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE))) throw AppError.forbidden('finance.approve is required to approve payment requests');
    return HoRunService.approveRequests(userId, body.voucherIds);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE], audit: { action: 'HO_RUN_ACTION', entity: 'PAYMENT_VOUCHER' } });
