import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';
import { CPE_MAX_LINES } from '@/lib/cpe-serial-rules';

export const dynamic = 'force-dynamic';

const cell = z.union([z.string().max(200), z.number()]).nullish();
export const cpeReceiptBodySchema = z.object({
    mode: z.enum(['DIRECT_TO_CONTRACTOR']),
    opmcId: databaseUuidSchema,
    contractorId: databaseUuidSchema.nullish(),
    cpeType: z.enum(['ONT', 'STB', 'PHONE']),
    model: z.string().max(80).nullish(),
    sltReference: z.string().max(120).nullish(),
    receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    remarks: z.string().max(500).nullish(),
    rows: z.array(z.object({ row: z.number().int(), serial: cell, cpeType: cell, model: cell })).min(1).max(CPE_MAX_LINES),
});

// GET /api/cpe-serials/receipts: the latest CPE receipts of the caller's RTOMs
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpeSerialService.receipts(params._userId);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });

// POST /api/cpe-serials/receipts: record (scan) the serials SLT gave a contractor of the RTOM - Area Coordinator / QC Officer
export const POST = apiHandler(async (_req, params, body: z.infer<typeof cpeReceiptBodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpeSerialService.receive({ userId: params._userId, ...body });
}, { schema: cpeReceiptBodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE], audit: { action: 'RECORD_CPE_RECEIPT', entity: 'CPE_RECEIPT' } });
