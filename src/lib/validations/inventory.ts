import { z } from 'zod';

export const reconciliationFilterSchema = z.object({
    contractorId: z.string().min(1, "Contractor is required"),
    storeId: z.string().min(1, "Store is required"),
    month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format (YYYY-MM)")
});

export const materialIssueSchema = z.object({
    contractorId: z.string(),
    storeId: z.string(),
    month: z.string(),
    items: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().positive(),
        unit: z.string()
    })).min(1),
    issuedBy: z.string().optional()
});

export const sodCompletionSchema = z.object({
    sltsStatus: z.enum(['COMPLETED', 'RETURN']),
    completedDate: z.string(),
    contractorId: z.string().optional(),
    comments: z.string().optional(),
    photoUrls: z.array(z.string()).optional(),
    materialUsage: z.array(z.object({
        itemId: z.string(),
        quantity: z.number(),
        unit: z.string().optional(),
        usageType: z.enum(['USED', 'WASTAGE', 'USED_F1', 'USED_G1']),
        serialNumber: z.string().optional(),
        comment: z.string().optional()
    })).optional()
});
