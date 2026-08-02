export interface User {
    id: string;
    name: string;
    role: string;
    storeId?: string;
    assignedStoreId?: string;
}

export interface StoreType {
    id: string;
    name: string;
    managerId?: string;
}

export interface KpiData {
    summary: {
        totalStockValue: number | null;
        totalStockQuantity: number;
        totalUniqueItems: number;
        lowStockCount: number;
        pendingDispatchCount: number;
        pendingGrnCount: number;
        pendingMrnCount: number;
    };
    lowStockAlerts: Array<{ id: string; name: string; category: string | null; minLevel: number; currentQty: number }>;
    pendingDispatches: Array<{
        id: string;
        requestNr: string;
        status: string;
        workflowStage: string;
        createdAt: string;
        requester?: { name: string } | null;
        items: Array<{ id: string; requestedQty: number; item: { name: string } }>;
    }>;
    pendingGrns: Array<{
        id: string;
        grnNumber: string;
        supplier: string | null;
        createdAt: string;
        request?: { requestNr: string; poNumber?: string } | null;
        purchaseOrder?: { poNumber: string; vendor: string | null } | null;
    }>;
}

export interface DashboardProps {
    user: User | null;
    stores: StoreType[];
    kpiData: KpiData | undefined;
    isLoading: boolean;
    refetch: () => void;
    selectedStoreId: string;
    setSelectedStoreId?: (id: string) => void;
}
