import { getAuthenticatedUserId } from '@/lib/request-context';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';

import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req: Request, params: any, body: any) => {
    const issueId = params?.id as string;
    const { signatureName } = body || {};
    const userId = getAuthenticatedUserId();

    if (!issueId) {
        throw AppError.badRequest('Issue ID is required.');
    }

    return await ContractorInventoryService.acceptMaterialIssue(issueId, signatureName, userId);
}, {
    permissions: [RBAC_PERMISSIONS.CONTRACTOR_WRITE],
    audit: { action: 'ACCEPT_CONTRACTOR_MATERIAL_ISSUE', entity: 'ContractorMaterialIssue' }
});
