import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SltBoqService } from '@/services/project/slt-boq.service';
import { userHasPermission } from '@/lib/user-permissions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;

/** Import an SLT BOQ workbook (customer request, cluster, or marketing invoice summary) as the project BOQ */
export const POST = apiHandler(async (request, params) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    // The BOQ is the pricing basis of every invoice: only project approvers and project finance may replace it
    const mayImport = await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_APPROVE)
        || await userHasPermission(userId, RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE);
    if (!mayImport) throw AppError.forbidden('Only a project approver or project finance can import a BOQ');
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) {
        throw AppError.badRequest('Expected multipart/form-data with an Excel file (key: "file")');
    }
    const form = await request.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    if (!file) throw AppError.badRequest('No Excel file provided (key: "file")');
    if (file.size > MAX_BYTES) throw AppError.badRequest('BOQ workbook is larger than 10 MB');
    if (!/\.xlsx?$/i.test(file.name)) throw AppError.badRequest('Only .xlsx / .xls workbooks can be imported');
    return await SltBoqService.importBoq(projectId, Buffer.from(await file.arrayBuffer()), userId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'IMPORT_SLT_BOQ', entity: 'PROJECT_BOQ' },
});
