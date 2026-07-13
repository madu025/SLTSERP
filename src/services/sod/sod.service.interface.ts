import { ServiceOrder } from '@prisma/client';
import { GetServiceOrdersParams, ServiceOrderUpdateData } from './sod-types';

export interface IServiceOrderService {
    getServiceOrders(userId: string, params: GetServiceOrdersParams): Promise<unknown>;
    bulkImportServiceOrders(rtom: string, data: Record<string, unknown>[], opmcId: string): Promise<unknown>;
    patchServiceOrder(id: string, data: ServiceOrderUpdateData, userId?: string): Promise<ServiceOrder>;
    syncPatResults(opmcId: string, rtom: string): Promise<unknown>;
    syncHoApprovedResults(): Promise<unknown>;
    syncHoRejectedResults(): Promise<unknown>;
    syncAllOpmcs(): Promise<unknown>;
    updateGlobalSyncStats(incremental: { created?: number; updated?: number; failed?: number }): Promise<void>;
    syncServiceOrders(opmcId: string, rtom: string): Promise<unknown>;
}
