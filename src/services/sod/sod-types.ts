export interface SltRejection {
    SO_NUM: string;
    LEA?: string;
    VOICENUMBER: string | null;
    S_TYPE: string;
    ORDER_TYPE: string;
    CON_WORO_TASK_NAME?: string;
    PKG?: string;
    CON_NAME?: string;
    PAT_USER: string | null;
    CON_STATUS_DATE: string;
    RTOM?: string;
}

export interface MaterialUsageInput {
    itemId: string;
    quantity: string;
    usageType: string;
    unit?: string;
    wastagePercent?: string;
    exceedsLimit?: boolean;
    comment?: string;
    serialNumber?: string;
}

export interface ServiceOrderUpdateData {
    sltsStatus?: string;
    status?: string;
    statusDate?: string | Date | null;
    receivedDate?: string | Date | null;
    completedDate?: string | Date | null;
    contractorId?: string | null;
    comments?: string | null;
    ontSerialNumber?: string | null;
    iptvSerialNumbers?: string | string[] | null;
    dpDetails?: string | null;
    teamId?: string | null;
    directTeamName?: string | null;
    dropWireDistance?: string | number | null;
    sltsPatStatus?: string | null;
    opmcPatStatus?: string | null;
    hoPatStatus?: string | null;
    materialUsage?: MaterialUsageInput[];
    returnReason?: string | null;
    wiredOnly?: boolean;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    techContact?: string | null;
    materialSource?: string | null;
}

export interface GetServiceOrdersParams {
    rtomId: string;
    filter?: string;
    search?: string;
    statusFilter?: string;
    patFilter?: string;
    matFilter?: string;
    page?: number;
    limit?: number;
    cursor?: string;
    month?: number;
    year?: number;
}
