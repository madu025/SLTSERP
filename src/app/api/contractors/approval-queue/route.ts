import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ContractorService } from '@/services/contractor/contractor.service';

export const dynamic = 'force-dynamic';

// GET /api/contractors/approval-queue - the contractor registrations waiting at the step the caller holds, inside their own areas:
// the Area Manager sees those waiting at the Area Manager step (ARM_PENDING), the OSP Manager those at the OSP step (OSP_PENDING).
// (The Registration Approvals page used the admin contractor list, which an Area Manager cannot open, so their queue was always empty.)
export const GET = apiHandler(async (_req, params) => {
    const userId = params._userId ?? undefined;
    const perms: string[] = params._permissions ?? [];
    const admin = perms.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    const statuses = [
        ...(admin || perms.includes(RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER) ? ['ARM_PENDING'] : []),
        ...(admin || perms.includes(RBAC_PERMISSIONS.INVOICE_OSP_APPROVE) ? ['OSP_PENDING'] : []),
    ];
    const lists = await Promise.all(statuses.map((status) => ContractorService.getAllContractors({ userId, page: 1, limit: 1000, status })));
    return { contractors: lists.flatMap((l) => l.contractors) };
}, { permissions: [RBAC_PERMISSIONS.ADMIN_RBAC, RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER, RBAC_PERMISSIONS.INVOICE_OSP_APPROVE] });
