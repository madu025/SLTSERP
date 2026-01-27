'use server';

import { ContractorService, ContractorUpdateData } from '@/services/contractor.service';
import { requireAuth } from '@/lib/server-utils';
import { revalidatePath } from 'next/cache';

export async function createContractor(data: ContractorUpdateData) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);

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
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);

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
    await requireAuth(['SUPER_ADMIN']);

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
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);
    try {
        const updated = await ContractorService.updateContractor(id, { status: 'ACTIVE' });
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        return { success: true, data: updated };
    } catch {
        return { success: false, error: 'Error approving contractor' };
    }
}

export async function rejectContractor(id: string) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);
    try {
        const updated = await ContractorService.updateContractor(id, { status: 'REJECTED' });
        revalidatePath('/admin/contractors');
        revalidatePath('/contractors');
        return { success: true, data: updated };
    } catch {
        return { success: false, error: 'Error rejecting contractor' };
    }
}
