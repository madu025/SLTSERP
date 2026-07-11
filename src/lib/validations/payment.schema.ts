import { z } from 'zod';
import { PaymentTypeEnum } from '@prisma/client';

export const createPaymentSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  payment_type: z.nativeEnum(PaymentTypeEnum),
  reference_id: z.string().min(1, 'Reference ID is required'),
  base_amount: z.number().nonnegative('Base amount must be non-negative'),
  tax_config_id: z.string().optional(),
  payment_method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHEQUE']),
  payment_ref_number: z.string().optional(),
  due_date: z.string().min(1, 'Due date is required'),
});

export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
