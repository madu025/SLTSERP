import { z } from 'zod';

export const serviceOrderPatchSchema = z.object({
    id: z.string().min(1, "ID is required"),
    sltsStatus: z.enum(['INPROGRESS', 'COMPLETED', 'RETURN', 'PROV_CLOSED']).optional(),
    completedDate: z.string().optional().nullable(),
    contractorId: z.string().optional().nullable(),
    comments: z.string().optional().nullable(),
    wiredOnly: z.boolean().optional(),
    ontSerialNumber: z.string().optional().nullable(),
    iptvSerialNumbers: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    dpDetails: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    directTeamName: z.string().optional().nullable(),
    dropWireDistance: z.union([z.string(), z.number()]).optional().nullable(),
    sltsPatStatus: z.string().optional().nullable(),
    opmcPatStatus: z.string().optional().nullable(),
    hoPatStatus: z.string().optional().nullable(),
    materialUsage: z.array(z.object({
        itemId: z.string(),
        quantity: z.string(),
        usageType: z.string(),
        unit: z.string().optional(),
        wastagePercent: z.string().optional(),
        exceedsLimit: z.boolean().optional(),
        comment: z.string().optional(),
        serialNumber: z.string().optional()
    })).optional()
});

export const serviceOrderUpdateSchema = z.object({
    id: z.string().min(1, "ID is required"),
    scheduledDate: z.string().optional().nullable(),
    scheduledTime: z.string().optional().nullable(),
    techContact: z.string().optional().nullable(),
    comments: z.string().optional().nullable()
});
export const serviceOrderCreateSchema = z.object({
    rtom: z.string().min(1, "RTOM is required"),
    rtomId: z.string().min(1, "RTOM ID is required"),
    soNum: z.string().optional().nullable(),
    voiceNumber: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    techContact: z.string().optional().nullable(),
    status: z.string().default('INPROGRESS'),
    orderType: z.string().optional().nullable(),
    serviceType: z.string().optional().nullable(),
    package: z.string().optional().nullable(),
    dp: z.string().optional().nullable(),
    sales: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
});
export const bridgeSyncSchema = z.object({
    soNum: z.string().min(1, "Service Order Number is required"),
    allTabs: z.record(z.string(), z.any()).optional(),
    teamDetails: z.record(z.string(), z.any()).optional(),
    materialDetails: z.array(z.object({
        TYPE: z.string().optional(),
        CODE: z.string().optional(),
        NAME: z.string().optional(),
        QTY: z.string().optional(),
        qty: z.union([z.string(), z.number()]).optional(),
        SERIAL: z.string().optional(),
        RAW: z.record(z.string(), z.any()).optional()
    })).optional(),
    forensicAudit: z.array(z.record(z.string(), z.any())).optional(),
    url: z.string().optional(),
    currentUser: z.string().optional(),
    activeTab: z.string().optional()
});

export const bulkImportSchema = z.object({
    rows: z.array(z.record(z.string(), z.any())).min(1, "At least one row is required"),
    rtom: z.string().min(1, "RTOM is required"),
    opmcId: z.string().min(1, "OPMC ID is required"),
    dryRun: z.boolean().optional().default(false)
});
