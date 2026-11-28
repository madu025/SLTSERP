import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpePhoneScanService } from '@/services/inventory/cpe-phone-scan.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ label: z.string().max(80).nullish(), mode: z.enum(['single', 'batch']).nullish() });

// POST /api/cpe-serials/phone-scan: start a "Scan with phone" session; the computer shows its token as a QR code
export const POST = apiHandler(async (_req, params, body: z.infer<typeof bodySchema>) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpePhoneScanService.create(params._userId, body);
}, { schema: bodySchema, permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ, RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE] });
