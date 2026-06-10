import { InventoryStore } from '@prisma/client';

export interface IInventoryService {
    getStores(where?: any): Promise<any[]>;
    createStore(data: any): Promise<InventoryStore>;
    updateStore(id: string, data: any): Promise<InventoryStore>;
    getStore(id: string): Promise<any | null>;
    deleteStore(id: string): Promise<void>;
    checkLowStock(storeId: string, itemId: string): Promise<void>;
    createStockRequest(data: any): Promise<any>;
    processStockRequestAction(data: any): Promise<any>;
}
