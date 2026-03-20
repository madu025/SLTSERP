export interface MaterialUsageRow {
    itemId: string;
    usedQty: string;
    wastageQty: string;
    f1Qty?: string;
    g1Qty?: string;
    wastageReason?: string;
    serialNumber?: string;
}

export interface OrderActionData {
    id: string;
    soNum?: string;
    package?: string | null;
    serviceType?: string | null;
    orderType?: string | null;
    iptv?: string | null;
    dp?: string | null;
    voiceNumber?: string | null;
    contractorId?: string | null;
    comments?: string | null;
    teamId?: string | null;
    sltsStatus?: string | null;
    completedDate?: string | null;
    ontSerialNumber?: string | null;
    directTeam?: string | null;
    completionMode?: string | null;
    iptvSerialNumbers?: string[] | null;
    opmcPatStatus?: string | null;
    sltsPatStatus?: string | null;
    hoPatStatus?: string | null;
    materialUsage?: Array<{
        itemId: string;
        quantity: number | string;
        usageType: string;
        serialNumber?: string | null;
        comment?: string | null;
    }> | null;
}

export interface Contractor {
    id: string;
    name: string;
    teams?: Array<{ id: string; name: string; sltCode?: string }>;
}

export interface InventoryItem {
    id: string;
    name: string;
    code: string;
    unit: string;
    commonFor?: string[] | string;
    commonName?: string | null;
    isOspFtth?: boolean;
    type?: string;
    maxWastagePercentage?: number;
    isWastageAllowed?: boolean;
    hasSerial?: boolean;
    importAliases?: string[];
}

export interface OrderCompletionData {
    id?: string;
    date?: string;
    sltsStatus?: string;
    materialUsage?: Array<{
        itemId: string;
        quantity: number;
        usageType: string;
        serialNumber?: string;
        comment?: string;
    }>;
    contractorId?: string;
    teamId?: string;
    directTeam?: string;
    ontSerialNumber?: string;
    iptvSerialNumbers?: string[];
    dpDetails?: string;
    completionMode?: string;
    comment?: string;
    assignmentType?: string;
    materialStatus?: string;
}
