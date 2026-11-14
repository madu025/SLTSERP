import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { SupplierInvoiceService } from '@/services/procurement/supplier-invoice.service';

export const dynamic = 'force-dynamic';

const create = z.object({
    action: z.literal('CREATE'),
    kind: z.enum(['STORE', 'PROJECT']),
    poId: databaseUuidSchema,
    invoiceNumber: z.string().min(1).max(80),
    invoiceDate: z.string().min(8),
    dueDate: z.string().nullish(),
    lines: z.array(z.object({ poItemId: databaseUuidSchema, quantity: z.number().positive(), unitPrice: z.number().min(0), taxAmount: z.number().min(0).optional() })).min(1),
});
const approve = z.object({ action: z.literal('APPROVE'), id: databaseUuidSchema, overrideReason: z.string().max(500).nullish() });
const reject = z.object({ action: z.literal('REJECT'), id: databaseUuidSchema, reason: z.string().min(3).max(500) });
const paid = z.object({ action: z.literal('MARK_PAID'), id: databaseUuidSchema });
const bodySchema = z.discriminatedUnion('action', [create, approve, reject, paid]);

// GET /api/procurement/invoices?status=&vendorId=            -> supplier invoices
// GET /api/procurement/invoices?po=STORE:<uuid>|PROJECT:<uuid> -> the PO lines with received / already-billed quantities
export const GET = apiHandler(async (req) => {
    const sp = new URL(req.url).searchParams;
    const po = sp.get('po');
    if (po) {
        const [kind, id] = po.split(':');
        if ((kind !== 'STORE' && kind !== 'PROJECT') || !id) throw AppError.badRequest('po must look like STORE:<id> or PROJECT:<id>');
        return SupplierInvoiceService.getPoContext(kind, id);
    }
    return SupplierInvoiceService.list({ status: sp.get('status') || undefined, vendorId: sp.get('vendorId') || undefined });
}, { permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ, RBAC_PERMISSIONS.FINANCE_READ] });

// POST /api/procurement/invoices  { action: CREATE | APPROVE | REJECT | MARK_PAID, ... }
// Entering and rejecting invoices needs procurement write; approving and marking paid needs finance approval.
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const perms = params._permissions ?? [];
    const can = (p: string) => perms.includes(p) || perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    switch (body.action) {
        case 'CREATE':
            if (!can(RBAC_PERMISSIONS.PROCUREMENT_WRITE)) throw AppError.forbidden('Entering a supplier invoice needs procurement write access');
            return SupplierInvoiceService.create({ ...body, userId });
        case 'REJECT':
            if (!can(RBAC_PERMISSIONS.PROCUREMENT_WRITE) && !can(RBAC_PERMISSIONS.FINANCE_APPROVE)) throw AppError.forbidden('You cannot reject supplier invoices');
            return SupplierInvoiceService.reject(body.id, userId, body.reason);
        case 'APPROVE':
            if (!can(RBAC_PERMISSIONS.FINANCE_APPROVE)) throw AppError.forbidden('Approving a supplier invoice needs finance approval access');
            return SupplierInvoiceService.approve(body.id, userId, body.overrideReason);
        case 'MARK_PAID':
            if (!can(RBAC_PERMISSIONS.FINANCE_APPROVE)) throw AppError.forbidden('Marking an invoice paid needs finance approval access');
            return SupplierInvoiceService.markPaid(body.id, userId);
    }
}, {
    schema: bodySchema,
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE],
    audit: { action: 'SUPPLIER_INVOICE_ACTION', entity: 'SUPPLIER_INVOICE', entityIdParam: 'id' },
});
