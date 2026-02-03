export interface ServiceOrder {
    id: string;
    rtom: string;
    lea: string | null;
    soNum: string;
    voiceNumber: string | null;
    orderType: string | null;
    serviceType: string | null;
    customerName: string | null;
    techContact: string | null;
    status: string;
    statusDate: string | null;
    address: string | null;
    dp: string | null;
    package: string | null;
    sales: string | null;
    woroTaskName: string | null;
    iptv: string | null;
    sltsStatus: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    comments: string | null;
    createdAt: string;
    contractorId?: string | null;
    teamId?: string | null;
    contractor?: { name: string };
    completedDate?: string | null;
    updatedAt?: string | null;
    ontSerialNumber?: string | null;
    iptvSerialNumbers?: string | null;
    dpDetails?: string | null;
    patStatus?: string | null;
    opmcPatStatus?: string | null;
    opmcPatDate?: string | null;
    sltsPatStatus?: string | null;
    hoPatStatus?: string | null;
    hoPatDate?: string | null;
    isInvoicable: boolean;
    revenueAmount?: number | null;
    contractorAmount?: number | null;
    dropWireDistance?: number | null;
    materialUsage?: Array<{
        itemId: string;
        quantity: number;
        usageType: string;
        serialNumber?: string | null;
        item?: { name: string; code: string; unit: string };
    }> | null;
    directTeam?: string | null;
    completionMode?: 'ONLINE' | 'OFFLINE';
    isManualEntry?: boolean;
    isLegacyImport?: boolean;
}

export interface AuditItem {
    name: string;
    status: string;
    uuid?: string;
}
