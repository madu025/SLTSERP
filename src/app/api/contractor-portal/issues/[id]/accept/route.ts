import { ROLE_GROUPS } from '@/config/roles';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';

import { AppError } from '@/lib/error';

import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (req: Request, params: any, body: any) => {
    const issueId = params?.id as string;
    const { signatureName } = body || {};
    const userId = req.headers.get('x-user-id');

    if (!issueId) {
        throw AppError.badRequest('Issue ID is required.');
    }

    return await ContractorInventoryService.acceptMaterialIssue(issueId, signatureName, userId);
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'ACCEPT_CONTRACTOR_MATERIAL_ISSUE', entity: 'ContractorMaterialIssue' }
});
