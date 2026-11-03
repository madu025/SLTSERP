'use server';

import { ContractorService, ContractorUpdateData } from '@/services/contractor/contractor.service';
import { requirePermission } from '@/lib/server-utils';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { revalidatePath } from 'next/cache';

export async function createContractor(data: ContractorUpdateData) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);

    try {
        const contractor = await ContractorService.createContractor(data);
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        return { success: true, data: contractor };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'NAME_AND_REGISTRATION_REQUIRED') {
            return { success: false, error: 'Name and Registration Number required' };
        }
        return { success: false, error: 'Error creating contractor' };
    }
}

export async function updateContractor(id: string, data: ContractorUpdateData) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);

    try {
        const updated = await ContractorService.updateContractor(id, data);
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        revalidatePath(`/contractors/${id}`);
        return { success: true, data: updated };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'ID_REQUIRED') {
            return { success: false, error: 'ID required' };
        }
        return { success: false, error: 'Error updating contractor' };
    }
}

export async function deleteContractor(id: string) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_SUPER);

    try {
        await ContractorService.deleteContractor(id);
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        return { success: true, message: 'Deleted successfully' };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'HAS_RELATED_DATA') {
            return { success: false, error: 'Cannot delete contractor: active assignments exist' };
        }
        return { success: false, error: 'Error deleting contractor' };
    }
}

export async function approveContractor(id: string) {
    const actor = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const updated = await ContractorService.approveContractor(id, actor.id);
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        revalidatePath('/contractors/management/approvals');
        return { success: true, data: updated };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Error approving contractor' };
    }
}

export async function approveContractorRegistration(id: string, teamCodes?: Record<string, string>) {
    const actor = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const updated = await ContractorService.approveContractor(id, actor.id, { teamCodes });
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        revalidatePath('/contractors/management/approvals');
        return { success: true, data: updated };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Error approving contractor' };
    }
}

export async function rejectContractor(id: string, reason = 'Rejected by authorized reviewer') {
    const actor = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const updated = await ContractorService.rejectContractor(id, actor.id, { reason });
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        revalidatePath('/contractors/management/approvals');
        return { success: true, data: updated };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Error rejecting contractor' };
    }
}

export async function rejectContractorRegistration(id: string, reason: string) {
    const actor = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const updated = await ContractorService.rejectContractor(id, actor.id, { reason });
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        revalidatePath('/contractors/management/approvals');
        return { success: true, data: updated };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Error rejecting contractor' };
    }
}
