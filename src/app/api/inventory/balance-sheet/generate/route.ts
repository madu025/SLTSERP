export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ContractorStoreService } from '@/services/inventory/contractor-store.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const POST = apiHandler(async (_request, params, body) => {
    const contractorId = body.contractorId as string | undefined;
    const storeId = body.storeId as string | undefined;
    const month = body.month as string | undefined;

    if (!contractorId || !storeId || !month) {
        throw AppError.badRequest('Missing required parameters');
    }

    // only the contractors of the person's own stores
    await ContractorStoreService.assertForStore(params._userId, contractorId, storeId);

    const reportData = await InventoryService.generateReportData({
        contractorId,
        storeId,
        month
    });

    return {
        month,
        contractorId,
        storeId,
        items: reportData
    };
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ], rawResponse: true });
