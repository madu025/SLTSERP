import { z } from 'zod';

export const materialIssueSchema = z.object({
    contractorId: z.string().min(1, 'Contractor is required'),
    storeId: z.string().min(1, 'Store is required'),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)'),
    items: z.array(z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        quantity: z.union([z.string(), z.number()]).transform(val => {
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) throw new Error('Invalid quantity');
            return num;
        }).refine(val => val > 0, 'Quantity must be greater than zero'),
        unit: z.string().optional()
    })).min(1, 'At least one item is required')
});

export const materialReturnSchema = z.object({
    contractorId: z.string().min(1, 'Contractor is required'),
    storeId: z.string().min(1, 'Store is required'),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)'),
    reason: z.string().optional(),
    items: z.array(z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        quantity: z.union([z.string(), z.number()]).transform(val => {
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) throw new Error('Invalid quantity');
            return num;
        }).refine(val => val > 0, 'Quantity must be greater than zero'),
        unit: z.string().optional(),
        condition: z.enum(['GOOD', 'DAMAGED']).default('GOOD')
    })).min(1, 'At least one item is required')
});

export const wastageSchema = z.object({
    storeId: z.string().optional(),
    contractorId: z.string().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)').optional(),
    description: z.string().optional(),
    reason: z.string().optional(),
    items: z.array(z.object({
        itemId: z.string().min(1, 'Item ID is required'),
        quantity: z.union([z.string(), z.number()]).transform(val => {
            const num = typeof val === 'string' ? parseFloat(val) : val;
            if (isNaN(num)) throw new Error('Invalid quantity');
            return num;
        }).refine(val => val > 0, 'Quantity must be greater than zero'),
        unit: z.string().optional()
    })).min(1, 'At least one item is required')
}).refine(data => data.storeId || data.contractorId, {
    message: 'Store ID or Contractor ID is required',
    path: ['storeId']
});
