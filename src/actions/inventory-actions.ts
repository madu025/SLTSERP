'use server';

import { InventoryService } from '@/services/inventory.service';
import { requireAuth } from '@/lib/server-utils';
import { revalidatePath } from 'next/cache';

// --- ITEM MANAGEMENT ---

export async function createItem(data: any) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']);
    try {
        const item = await InventoryService.createItem(data);
        revalidatePath('/inventory/items');
        return { success: true, data: item };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating item' };
    }
}

export async function updateItem(id: string, data: any) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']);
    try {
        const item = await InventoryService.updateItem(id, data);
        revalidatePath('/inventory/items');
        return { success: true, data: item };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error updating item' };
    }
}

export async function deleteItem(id: string) {
    await requireAuth(['SUPER_ADMIN']);
    try {
        await InventoryService.deleteItem(id);
        revalidatePath('/inventory/items');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error deleting item' };
    }
}

export async function mergeItemsAction(sourceId: string, targetId: string) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);
    try {
        await InventoryService.mergeItems(sourceId, targetId);
        revalidatePath('/inventory/items');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error merging items' };
    }
}

export async function patchBulkItemsAction(updates: any[]) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']);
    try {
        await InventoryService.patchBulkItems(updates);
        revalidatePath('/inventory/items');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error performing bulk update' };
    }
}

// --- STORE MANAGEMENT ---

export async function createStore(data: any) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);
    try {
        const store = await InventoryService.createStore(data);
        revalidatePath('/admin/stores');
        return { success: true, data: store };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating store' };
    }
}

export async function updateStore(id: string, data: any) {
    await requireAuth(['ADMIN', 'SUPER_ADMIN']);
    try {
        const store = await InventoryService.updateStore(id, data);
        revalidatePath('/admin/stores');
        return { success: true, data: store };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error updating store' };
    }
}

export async function deleteStore(id: string) {
    await requireAuth(['SUPER_ADMIN']);
    try {
        await InventoryService.deleteStore(id);
        revalidatePath('/admin/stores');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error deleting store' };
    }
}

// --- GRN / MRN OPERATIONS ---

export async function createGRN(data: any) {
    const user = await requireAuth(['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.createGRN({
            ...data,
            receivedById: user.id
        });
        revalidatePath('/inventory/grn');
        revalidatePath('/inventory/stock');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating GRN' };
    }
}

export async function createMRN(data: any) {
    await requireAuth(['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.createMRN(data);
        revalidatePath('/inventory/mrn');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating MRN' };
    }
}

export async function updateMRNStatus(mrnId: string, action: 'APPROVE' | 'REJECT') {
    const user = await requireAuth(['STORES_MANAGER', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.updateMRNStatus(mrnId, action, user.id);
        revalidatePath('/inventory/mrn');
        revalidatePath('/inventory/stock');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error updating MRN status' };
    }
}

// --- STOCK REQUESTS & ISSUES ---

export async function createStockRequest(data: any) {
    const user = await requireAuth(['AREA_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'ENGINEER', 'AREA_COORDINATOR']);
    try {
        const result = await InventoryService.createStockRequest({
            ...data,
            requestedById: user.id
        });
        revalidatePath('/inventory/requests');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating stock request' };
    }
}

export async function createStockIssue(data: any) {
    const user = await requireAuth(['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.createStockIssue({
            ...data,
            issuedById: user.id
        });
        revalidatePath('/inventory/issues');
        revalidatePath('/inventory/stock');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error creating stock issue' };
    }
}

export async function processStockRequestAction(data: any) {
    const user = await requireAuth(['STORES_MANAGER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.processStockRequestAction({
            ...data,
            userId: user.id
        });
        revalidatePath('/inventory/requests');
        revalidatePath('/inventory/stock');
        revalidatePath('/inventory/grn');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error processing stock request' };
    }
}

// --- MATERIAL ISSUANCE & WASTAGE ---

export async function issueMaterial(data: any) {
    const user = await requireAuth(['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']);
    try {
        const result = await InventoryService.issueMaterial({
            ...data,
            userId: user.id
        });
        revalidatePath('/inventory/issuance');
        revalidatePath('/inventory/stock');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error issuing material' };
    }
}

export async function recordWastage(data: any) {
    const user = await requireAuth(['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'QC_OFFICER']);
    try {
        const result = await InventoryService.recordWastage({
            ...data,
            userId: user.id
        });
        revalidatePath('/inventory/wastage');
        revalidatePath('/inventory/stock');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error recording wastage' };
    }
}
