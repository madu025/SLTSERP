import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { assertVoucherAccess } from '@/lib/payment-voucher-access';
import { HoPaymentService } from '@/services/procurement/ho-payment.service';
import { PvChainService } from '@/services/finance/pv-chain.service';

export const dynamic = 'force-dynamic';

const idSchema = z.object({ id: databaseUuidSchema });
const recordSchema = z.object({ amount: z.number().positive(), paidDate: z.string().max(40), reference: z.string().min(3).max(100), method: z.string().max(20).nullish(), remarks: z.string().max(500).nullish() });

/** The same voucher scope check as the voucher status route: a caller only sees and pays vouchers inside their scope. */
async function voucherInScope(id: string, userId: string) {
    const voucher = await prisma.paymentVoucher.findUnique({ where: { id }, select: { projectId: true, description: true, supplierInvoiceId: true } });
    if (!voucher) throw AppError.notFound('Payment voucher not found');
    // a company-flow voucher belongs to no area: its chain's people reach it; any other voucher needs the normal voucher access
    if (await PvChainService.isChainVoucher(voucher.supplierInvoiceId)) return PvChainService.assertChainAccess(voucher, userId);
    await assertVoucherAccess(voucher.projectId, userId, voucher.description);
}

// GET /api/finance/payment-vouchers/:id/payments
// What HO has paid on this voucher so far, the balance, and each payment.
export const GET = apiHandler(async (_req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = idSchema.parse(params);
    await voucherInScope(id, userId);
    return HoPaymentService.listForVoucher(id);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.PROCUREMENT_READ] });

// POST /api/finance/payment-vouchers/:id/payments  { amount, paidDate, reference, method?, remarks? }
// The Account Executive at HO records a payment HO made on the voucher (in full or one part); it is posted at once.
export const POST = apiHandler(async (_req, params, body: z.infer<typeof recordSchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = idSchema.parse(params);
    await voucherInScope(id, userId);
    return HoPaymentService.record({ voucherId: id, userId, ...body });
}, {
    schema: recordSchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD],
    audit: { action: 'RECORD_HO_PAYMENT', entity: 'PAYMENT_VOUCHER', entityIdParam: 'id' },
});
