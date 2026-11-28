import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';
import { CPE_MAX_LINES } from '@/lib/cpe-serial-rules';

export const dynamic = 'force-dynamic';

const cell = z.union([z.string().max(200), z.number()]).nullish();
const bodySchema = z.object({
    opmcId: databaseUuidSchema,
    cpeType: z.enum(['ONT', 'STB', 'PHONE']),
    rows: z.array(z.object({ row: z.number().int(), serial: cell, cpeType: cell, model: cell })).min(1).max(CPE_MAX_LINES),
});

// POST /api/cpe-serials/receipts/preview: judge every line of an upload or scan list (new, issued again by SLT, or why not) - saves nothing
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpeSerialService.preview({ userId: params._userId, ...body });
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE] });
