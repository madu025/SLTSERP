import { Vehicle } from '../fleet/vehicle.types';

export enum PaymentType {
  RENTAL = 'RENTAL',
  MAINTENANCE = 'MAINTENANCE',
  INSURANCE_PREMIUM = 'INSURANCE_PREMIUM',
  FUEL = 'FUEL',
  DRIVER_OT_SALARY = 'DRIVER_OT_SALARY',
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  FINE = 'FINE',
  REGISTRATION = 'REGISTRATION',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export interface Payment {
  id: string;
  invoice_id: string;
  payment_type: PaymentType;
  reference_id: string;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
  tax_config_id?: string;
  tax_rate_percent?: number;
  tax_type?: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  payment_date?: Date;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_ref_number?: string;
  status: PaymentStatus;
  due_date: Date;
  payment_received_date?: Date;
  notes?: string;
  invoice?: { id: string; invoice_number: string; total_amount: number } | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentDTO {
  invoice_id: string;
  payment_type: PaymentType;
  reference_id: string;
  base_amount: number;
  tax_config_id?: string;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_ref_number?: string;
  due_date: Date;
}