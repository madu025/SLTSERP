import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SltBoqService } from '@/services/project/slt-boq.service';

export const dynamic = 'force-dynamic';

/** Create the draft client invoice (final or part) from the project's SLT BOQ; approval follows the invoice workflow */
export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const draft = await SltBoqService.createCompletionInvoiceDraft(projectId, userId);
    return draft ?? { message: 'Nothing left to invoice: every BOQ line is already invoiced.' };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE_BOQ_INVOICE_DRAFT', entity: 'PROJECT_INVOICE' },
});
