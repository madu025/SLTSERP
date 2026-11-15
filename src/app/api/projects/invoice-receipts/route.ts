import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const receiptSchema = z.object({
  invoiceId: databaseUuidSchema,
  amount: z.number().finite().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH']).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  receiptDate: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// OSP has no bank: Head Office collects from SLT and confirms the collection (POST /api/finance/ho/billing, /finance/ho-billing).
// Kept so old clients get a clear message instead of a bank posting.
export const POST = apiHandler(async (_request, params, body: z.infer<typeof receiptSchema>) => {
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  const invoice = await prisma.projectInvoice.findUnique({
    where: { id: body.invoiceId },
    select: { projectId: true },
  });
  if (!invoice) throw AppError.notFound('Invoice not found');
  await assertProjectAccess(invoice.projectId, params._userId);
  throw AppError.badRequest('CLIENT_RECEIPTS_ARE_COLLECTED_BY_HEAD_OFFICE: send the invoice to Head Office and let it confirm the collection');
}, {
  schema: receiptSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
  audit: { action: 'CREATE', entity: 'PROJECT_INVOICE_RECEIPT' },
  rawResponse: true,
});
