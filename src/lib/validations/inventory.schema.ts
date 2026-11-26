import { z } from 'zod';
import { databaseUuidSchema } from './uuid.schema';

/**
 * Inventory quantities are physical movements, so zero, negative, NaN and
 * Infinity are never valid at an API boundary. Keep the string form for
 * existing mobile/browser payloads, but normalize it before the service sees
 * it.
 */
export const inventoryQuantitySchema = z.union([z.string(), z.number()])
    .transform((value) => typeof value === 'string' ? Number(value.trim()) : value)
    .refine((value) => Number.isFinite(value), 'Quantity must be a finite number')
    .refine((value) => value > 0, 'Quantity must be greater than zero');

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
        quantity: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseFloat(v) : v)
            .refine((q) => Number.isFinite(q) && q > 0, 'Quantity must be a number greater than zero'),
        unit: z.string().optional(),
        // serial-tracked items: the serial numbers handed over (verified against the store by the issue service)
        serials: z.array(z.string()).optional()
    })).min(1, "At least one item is required")
});

export const grnSchema = z.object({
    storeId: z.string().min(1),
    // StockRequest.sourceType is a domain string and includes procurement
    // routes such as LOCAL_PURCHASE and EMERGENCY_LOCAL.
    sourceType: z.string().trim().min(1).max(40),
    supplier: z.string().nullish(),
    sltReferenceId: z.string().nullish(),
    requestId: z.string().nullish(),
    purchaseOrderId: z.string().nullish(),
    documentUrl: z.string().nullish(),
    reference: z.string().nullish(),
    notes: z.string().nullish(),
    items: z.array(z.object({
        itemId: z.string().min(1),
        quantity: inventoryQuantitySchema,
        serials: z.array(z.string()).optional(),
        expiryDate: z.union([z.string(), z.date()]).optional(),
        locator: z.string().optional(),
        // one GRN may receive the goods of several purchase orders: each line names its PO line
        poItemId: databaseUuidSchema.nullish(),
        // delivered but rejected by the Stores Manager (quantity is what was accepted)
        rejectedQty: z.number().min(0).nullish(),
        rejectReason: z.string().max(300).nullish(),
    })).min(1),
    // HO orders: the Oracle GRN number and the vendor's invoice for this delivery
    oracleGrnNumber: z.string().max(60).nullish(),
    vendorInvoiceNumber: z.string().max(60).nullish(),
    vendorInvoiceDate: z.string().max(40).nullish(),
    vendorInvoiceGoods: z.number().min(0).nullish(),
    vendorInvoiceTax: z.number().min(0).nullish(),
    vendorInvoiceUrl: z.string().max(1000).nullish(),
});

export const mrnSchema = z.object({
    storeId: z.string().min(1),
    returnType: z.string().trim().min(1).max(40),
    returnTo: z.string().trim().nullish(),
    supplier: z.string().trim().nullish(),
    reason: z.string().trim().nullish(),
    grnId: z.string().min(1).nullish(),
    items: z.array(z.object({
        itemId: z.string().min(1),
        quantity: inventoryQuantitySchema,
        reason: z.string().trim().nullish(),
    })).min(1),
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
        condition: z.enum(['GOOD', 'DAMAGED', 'FAULTY']).default('GOOD'),
        serials: z.array(z.string()).optional()
    })).min(1, 'At least one item is required')
});
