import { PaymentType } from './payment.types';
export interface Invoice {
  id: string;
  invoice_number: string;
  issued_by_site_id: string;
  issued_to_customer_id?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax_before_discount?: boolean;
  total_tax: number;
  total_amount: number;
  invoice_date: Date;
  due_date: Date;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  description?: string;
  created_at: Date;
  updated_at: Date;
}
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_config_id?: string;
  tax_rate_percent?: number;
  line_tax: number;
  item_type: PaymentType;
  reference_id?: string;
}
export interface TaxConfig {
  id: string;
  tax_name: string;
  tax_type: 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER';
  tax_rate_percent: number;
  effective_from_date: Date;
  effective_to_date?: Date;
  applicable_to: PaymentType[];
  tax_inclusive: boolean;
  tax_exempt_items?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_at: Date;
  updated_at: Date;
}
export interface CreateInvoiceDTO {
  issued_by_site_id: string;
  issued_to_customer_id?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_config_id?: string;
    item_type: PaymentType;
    reference_id?: string;
  }>;
  invoice_date: Date;
  due_date: Date;
}