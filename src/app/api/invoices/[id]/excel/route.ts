import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InvoiceExcelService } from '@/services/invoice/invoice-excel.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({ id: z.string().min(1), part: z.enum(['A', 'B']).default('A') });

// GET /api/invoices/:id/excel?part=A|B - the contractor invoice workbook (SLTS template). Part A = 90 %, Part B = 10 %.
export const GET = apiHandler(async (req, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const q = querySchema.parse({ id: params.id, part: new URL(req.url).searchParams.get('part') ?? undefined });
    const { buffer, warnings, fileName } = await InvoiceExcelService.build(q.id, q.part, userId);
    return new Response(new Uint8Array(buffer), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'X-Export-Warnings': encodeURIComponent(warnings.join(' || ')),
            'Cache-Control': 'no-store',
        },
    });
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE], rawResponse: true });
