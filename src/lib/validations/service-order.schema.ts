import { z } from 'zod';

export const serviceOrderPatchSchema = z.object({
    id: z.string().min(1, "ID is required"),
    sltsStatus: z.enum(['INPROGRESS', 'COMPLETED', 'RETURN']).optional(),
    completedDate: z.string().optional().nullable(),
    contractorId: z.string().optional().nullable(),
    comments: z.string().optional().nullable(),
    ontSerialNumber: z.string().optional().nullable(),
    iptvSerialNumbers: z.array(z.string()).optional().nullable(),
    dpDetails: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    directTeamName: z.string().optional().nullable(),
    completionMode: z.enum(['ONLINE', 'OFFLINE']).optional(),
    patStatus: z.enum(['PASS', 'REJECTED', 'PENDING', 'COMPLETED', 'VERIFIED']).optional().nullable()
});

export const serviceOrderUpdateSchema = z.object({
    id: z.string().min(1, "ID is required"),
    scheduledDate: z.string().optional().nullable(),
    scheduledTime: z.string().optional().nullable(),
    techContact: z.string().optional().nullable(),
    comments: z.string().optional().nullable()
});
