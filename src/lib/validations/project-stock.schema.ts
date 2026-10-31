import { z } from 'zod';

export const stockIssueItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  remarks: z.string().optional(),
});

export const createStockIssueSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  storeId: z.string().min(1, 'Store ID is required'),
  items: z.array(stockIssueItemSchema).min(1, 'At least one item is required'),
  reservationId: z.string().uuid().optional(),
  requirementId: z.string().uuid().optional(),
  remarks: z.string().optional(),
  issueDate: z.string().optional(),
});

export const approveStockIssueSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
});

export const returnItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  condition: z.enum(['GOOD', 'DAMAGED']).optional(),
  remarks: z.string().optional(),
});

export const createReturnSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  storeId: z.string().min(1, 'Store ID is required'),
  issueId: z.string().uuid('Approved source issue is required'),
  items: z.array(returnItemSchema).min(1, 'At least one item is required'),
  reason: z.string().optional(),
});

export const approveReturnSchema = z.object({
  returnId: z.string().min(1, 'Return ID is required'),
});

export type CreateStockIssueSchema = z.infer<typeof createStockIssueSchema>;
export type ApproveStockIssueSchema = z.infer<typeof approveStockIssueSchema>;
export type CreateReturnSchema = z.infer<typeof createReturnSchema>;
export type ApproveReturnSchema = z.infer<typeof approveReturnSchema>;
