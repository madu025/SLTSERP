import { z } from 'zod';

export const serviceOrderPatchSchema = z.object({
    id: z.string().min(1, "ID is required"),
    sltsStatus: z.enum(['INPROGRESS', 'COMPLETED', 'RETURN', 'PROV_CLOSED']).optional(),
    completedDate: z.string().optional().nullable(),
    contractorId: z.string().optional().nullable(),
    comments: z.string().optional().nullable(),
    wiredOnly: z.boolean().optional(),
    ontSerialNumber: z.string().optional().nullable(),
    iptvSerialNumbers: z.array(z.string()).optional().nullable(),
    dpDetails: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    directTeamName: z.string().optional().nullable(),
    completionMode: z.enum(['ONLINE', 'OFFLINE']).optional(),
    patStatus: z.enum(['PASS', 'REJECTED', 'PENDING', 'COMPLETED', 'VERIFIED']).optional().nullable(),
    opmcPatStatus: z.enum(['PASS', 'REJECTED', 'PENDING']).optional().nullable(),
    sltsPatStatus: z.enum(['PASS', 'REJECTED', 'PENDING']).optional().nullable(),
    hoPatStatus: z.enum(['PASS', 'REJECTED', 'PENDING']).optional().nullable()
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
