import { z } from 'zod';

export const inventoryItemSchema = z.object({
    code: z.string().min(1, "Code is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    unit: z.string().default('Nos'),
    type: z.enum(['SLT', 'SLTS', 'COMPANY', 'OTHER']).default('SLTS'),
    category: z.string().default('OTHERS'),
    commonFor: z.array(z.string()).optional(),
    minLevel: z.number().nonnegative().optional().default(0),
    unitPrice: z.number().nonnegative().optional().default(0),
    costPrice: z.number().nonnegative().optional().default(0),
    isWastageAllowed: z.boolean().default(true),
    maxWastagePercentage: z.number().nonnegative().optional().default(0)
});

export const materialIssueSchema = z.object({
    contractorId: z.string().min(1, "Contractor is required"),
    storeId: z.string().min(1, "Store is required"),
    month: z.string().min(1, "Month is required"),
    items: z.array(z.object({
        itemId: z.string().min(1),
        quantity: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseFloat(v) : v),
        unit: z.string().optional()
    })).min(1, "At least one item is required")
});

export const grnSchema = z.object({
    storeId: z.string().min(1),
    sourceType: z.enum(['SLT', 'SUPPLIER', 'INTERNAL']),
    supplier: z.string().optional(),
    sltReferenceId: z.string().optional(),
    requestId: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        itemId: z.string().min(1),
        quantity: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseFloat(v) : v)
    })).min(1)
});
