import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SltBoqService } from '@/services/project/slt-boq.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Download the invoice document pack (xlsx); the sheets follow the project type's document profile */
export const GET = apiHandler(async (_request, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const { buffer, fileName } = await SltBoqService.buildPackForInvoice(params.invoiceId, userId);
    return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'no-store',
        },
    });
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });
