import { z } from 'zod';

export const createInvoiceSchema = z.object({
    invoiceNumber: z.string().min(1, 'Invoice number is required'),
    contractorId: z.string().min(1, 'Contractor ID is required'),
    projectId: z.string().optional().nullable(),
    amount: z.union([z.number(), z.string()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val),
    description: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
});

export const updateInvoiceSchema = z.object({
    id: z.string().min(1, 'Invoice ID is required'),
    status: z.string().optional(),
    amount: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? (typeof val === 'string' ? parseFloat(val) : val) : undefined),
    description: z.string().optional().nullable(),
    connectionTitle: z.string().optional().nullable(),
    agreementNumber: z.string().optional().nullable(),
    projectNumber: z.union([z.number(), z.string()]).optional().nullable().transform((val) => {
        if (val === undefined || val === null || val === '') return null;
        return typeof val === 'string' ? parseInt(val) : val;
    }),
    bomNumber: z.string().optional().nullable(),
    rtomArea: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
});

export type CreateInvoiceDTO = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceDTO = z.infer<typeof updateInvoiceSchema>;
