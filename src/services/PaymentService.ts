/**
 * Payment Service - Business logic for payments and invoicing with tax/VAT support
 */

import { Payment, CreatePaymentDTO, Invoice, CreateInvoiceDTO, PaymentStatus, PaymentType } from '@/types/vehicle-management.types';
import { prisma as db } from '@/lib/prisma';

// Workaround for IDE/Language Server caching issues with dynamic extended PrismaClient types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = db as any;

interface PrismaPaymentModel {
  id: string;
  invoice_id: string;
  payment_type: string;
  reference_id: string;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
  tax_config_id: string | null;
  tax_rate_percent: number | null;
  tax_type: string | null;
  payment_date: Date | null;
  payment_method: string;
  payment_ref_number: string | null;
  status: string;
  due_date: Date;
  payment_received_date: Date | null;
  notes: string | null;
  invoice?: { id: string; invoice_number: string; total_amount: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaInvoiceItemModel {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_config_id: string | null;
  tax_rate_percent: number | null;
  line_tax: number;
  item_type: string;
  reference_id: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaInvoiceModel {
  id: string;
  invoice_number: string;
  site_id: string;
  items?: PrismaInvoiceItemModel[];
  subtotal: number;
  total_tax: number;
  total_amount: number;
  invoice_date: Date;
  due_date: Date;
  status: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentService {
  /**
   * Create an invoice
   */
  async createInvoice(data: CreateInvoiceDTO): Promise<Invoice> {
    try {
      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;

      // Process items and calculate taxes
      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const lineTotal = item.quantity * item.unit_price;
          subtotal += lineTotal;

          // Get tax config if provided
          let lineTax = 0;
          if (item.tax_config_id) {
            const taxConfig = await prisma.vMTaxConfig.findUnique({
              where: { id: item.tax_config_id },
            });

            if (taxConfig) {
              lineTax = this.calculateTax(lineTotal, taxConfig.tax_rate_percent, taxConfig.tax_inclusive);
            }
          }

          totalTax += lineTax;

          return {
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: lineTotal,
            tax_config_id: item.tax_config_id,
            tax_rate_percent: item.tax_config_id ? (await this.getTaxRate(item.tax_config_id)) : null,
            line_tax: lineTax,
            item_type: item.item_type,
            reference_id: item.reference_id,
          };
        })
      );

      const totalAmount = subtotal + totalTax;

      // Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber(data.issued_by_site_id);

      // Create invoice in DB
      const invoice = await prisma.vMInvoice.create({
        data: {
          invoice_number: invoiceNumber,
          site_id: data.issued_by_site_id,
          issued_to_customer_id: data.issued_to_customer_id,
          subtotal,
          total_tax: totalTax,
          total_amount: totalAmount,
          invoice_date: new Date(),
          due_date: data.due_date,
          status: 'DRAFT',
          items: {
            create: processedItems.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              tax_config_id: item.tax_config_id,
              tax_rate_percent: item.tax_rate_percent,
              line_tax: item.line_tax,
              item_type: item.item_type,
              reference_id: item.reference_id,
            })),
          },
        },
        include: { items: true },
      });

      return this.mapInvoiceToDTO(invoice);
    } catch (error) {
      throw new Error(`Failed to create invoice: ${(error as Error).message}`);
    }
  }

  /**
   * Get an invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice | null> {
    try {
      const invoice = await prisma.vMInvoice.findUnique({
        where: { id },
        include: { items: true },
      });
      return invoice ? this.mapInvoiceToDTO(invoice) : null;
    } catch (error) {
      throw new Error(`Failed to fetch invoice: ${(error as Error).message}`);
    }
  }

  /**
   * Create a payment for an invoice
   */
  async createPayment(data: CreatePaymentDTO): Promise<Payment> {
    try {
      // Get tax configuration
      let taxAmount = 0;
      if (data.tax_config_id) {
        const taxRate = await this.getTaxRate(data.tax_config_id);
        taxAmount = this.calculateTax(data.base_amount, taxRate);
      }

      const totalAmount = data.base_amount + taxAmount;

      const payment = await prisma.vMPayment.create({
        data: {
          invoice_id: data.invoice_id,
          payment_type: data.payment_type,
          reference_id: data.reference_id,
          base_amount: data.base_amount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          tax_config_id: data.tax_config_id,
          tax_rate_percent: data.tax_config_id ? (await this.getTaxRate(data.tax_config_id)) : null,
          payment_method: data.payment_method,
          payment_ref_number: data.payment_ref_number,
          due_date: data.due_date,
          status: 'PENDING',
        },
        include: { invoice: true },
      });

      return this.mapPaymentToDTO(payment);
    } catch (error) {
      throw new Error(`Failed to create payment: ${(error as Error).message}`);
    }
  }

  /**
   * Record a payment receipt
   */
  async recordPaymentReceipt(paymentId: string, amount: number, paymentDate: Date, paymentRefNumber?: string): Promise<Payment> {
    try {
      const payment = await prisma.vMPayment.findUnique({
        where: { id: paymentId },
        include: { invoice: true },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === 'COMPLETED') {
        throw new Error('Payment is already completed');
      }

      // Determine payment status
      let newStatus = payment.status;
      if (amount >= payment.total_amount) {
        newStatus = 'COMPLETED';
      } else if (amount > 0) {
        newStatus = 'PARTIAL';
      }

      const updatedPayment = await prisma.vMPayment.update({
        where: { id: paymentId },
        data: {
          payment_date: paymentDate,
          payment_received_date: paymentDate,
          status: newStatus,
          ...(paymentRefNumber ? { payment_ref_number: paymentRefNumber } : {}),
        },
        include: { invoice: true },
      });

      // Update invoice status if applicable
      if (updatedPayment.invoice_id && newStatus === 'COMPLETED') {
        const invoicePayments = await prisma.vMPayment.findMany({
          where: { invoice_id: updatedPayment.invoice_id, status: 'COMPLETED' },
        });

        const totalPaid = invoicePayments.reduce((sum: number, p: { total_amount: number }) => sum + p.total_amount, 0);
        const invoice = updatedPayment.invoice;

        if (invoice) {
          if (totalPaid >= invoice.total_amount) {
            await prisma.vMInvoice.update({
              where: { id: updatedPayment.invoice_id },
              data: { status: 'PAID' },
            });
          } else {
            await prisma.vMInvoice.update({
              where: { id: updatedPayment.invoice_id },
              data: { status: 'PARTIALLY_PAID' },
            });
          }
        }
      }

      return this.mapPaymentToDTO(updatedPayment);
    } catch (error) {
      throw new Error(`Failed to record payment receipt: ${(error as Error).message}`);
    }
  }

  /**
   * List payments with filters
   */
  async listPayments(filters: {
    payment_type?: PaymentType;
    status?: PaymentStatus;
    invoice_id?: string;
    from_date?: Date;
    to_date?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Payment[]; total: number }> {
    try {
      const { page = 1, limit = 20, from_date, to_date, ...where } = filters;
      const skip = (page - 1) * limit;

      const whereClause: Record<string, unknown> = { ...where };
      if (from_date || to_date) {
        whereClause.due_date = {
          ...(from_date && { gte: from_date }),
          ...(to_date && { lte: to_date }),
        };
      }

      const [payments, total] = await Promise.all([
        prisma.vMPayment.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { invoice: true },
        }),
        prisma.vMPayment.count({ where: whereClause }),
      ]);

      return {
        data: (payments as unknown as PrismaPaymentModel[]).map((p) => this.mapPaymentToDTO(p)),
        total,
      };
    } catch (error) {
      throw new Error(`Failed to list payments: ${(error as Error).message}`);
    }
  }

  /**
   * Create or get tax configuration
   */
  async ensureTaxConfig(taxName: string, taxRate: number, taxType: string): Promise<string> {
    try {
      const existing = await prisma.vMTaxConfig.findFirst({
        where: {
          tax_name: taxName,
          tax_rate_percent: taxRate,
        },
      });

      if (existing) {
        return existing.id;
      }

      const taxConfig = await prisma.vMTaxConfig.create({
        data: {
          tax_name: taxName,
          tax_type: taxType,
          tax_rate_percent: taxRate,
          effective_from_date: new Date(),
          applicable_to: JSON.stringify(['RENTAL', 'MAINTENANCE', 'FUEL', 'OTHER']),
          tax_inclusive: false,
          status: 'ACTIVE',
        },
      });

      return taxConfig.id;
    } catch (error) {
      throw new Error(`Failed to ensure tax config: ${(error as Error).message}`);
    }
  }

  /**
   * Generate financial report for payments
   */
  async getPaymentReport(filters: {
    from_date: Date;
    to_date: Date;
    payment_type?: PaymentType;
    site_id?: string;
  }) {
    try {
      const whereClause: Record<string, unknown> = {
        createdAt: {
          gte: filters.from_date,
          lte: filters.to_date,
        },
      };

      if (filters.payment_type) {
        whereClause.payment_type = filters.payment_type;
      }

      const payments = await prisma.vMPayment.findMany({
        where: whereClause,
        include: { invoice: true },
      });

      // Group by payment type
      const byType: Record<string, { count: number; total_base: number; total_tax: number; total_amount: number }> = {};
      let totalAmount = 0;
      let totalTax = 0;
      let totalBase = 0;

      (payments as unknown as PrismaPaymentModel[]).forEach((payment) => {
        if (!byType[payment.payment_type]) {
          byType[payment.payment_type] = {
            count: 0,
            total_base: 0,
            total_tax: 0,
            total_amount: 0,
          };
        }
        byType[payment.payment_type].count += 1;
        byType[payment.payment_type].total_base += payment.base_amount;
        byType[payment.payment_type].total_tax += payment.tax_amount;
        byType[payment.payment_type].total_amount += payment.total_amount;

        totalAmount += payment.total_amount;
        totalTax += payment.tax_amount;
        totalBase += payment.base_amount;
      });

      return {
        period: {
          from: filters.from_date,
          to: filters.to_date,
        },
        summary: {
          total_transactions: payments.length,
          total_base_amount: parseFloat(totalBase.toFixed(2)),
          total_tax_collected: parseFloat(totalTax.toFixed(2)),
          total_amount: parseFloat(totalAmount.toFixed(2)),
        },
        by_type: byType,
        status_breakdown: {
          completed: (payments as unknown as PrismaPaymentModel[]).filter((p) => p.status === 'COMPLETED').length,
          pending: (payments as unknown as PrismaPaymentModel[]).filter((p) => p.status === 'PENDING').length,
          partial: (payments as unknown as PrismaPaymentModel[]).filter((p) => p.status === 'PARTIAL').length,
          overdue: (payments as unknown as PrismaPaymentModel[]).filter((p) => p.status === 'OVERDUE').length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate payment report: ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate tax amount
   */
  private calculateTax(amount: number, taxRate: number, isInclusive = false): number {
    if (isInclusive) {
      return amount - (amount / (1 + taxRate / 100));
    }
    return (amount * taxRate) / 100;
  }

  /**
   * Get tax rate from config
   */
  private async getTaxRate(taxConfigId: string): Promise<number> {
    const config = await prisma.vMTaxConfig.findUnique({
      where: { id: taxConfigId },
    });
    return config?.tax_rate_percent || 0;
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(siteId: string): Promise<string> {
    const site = await prisma.vMSite.findUnique({
      where: { id: siteId },
    });

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Count invoices for this site/month
    const count = await prisma.vMInvoice.count({
      where: {
        site_id: siteId,
        invoice_date: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1),
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${site?.code || 'XXX'}-${year}${month}-${sequence}`;
  }

  /**
   * Map payment to DTO
   */
  private mapPaymentToDTO(payment: PrismaPaymentModel): Payment {
    return {
      id: payment.id,
      invoice_id: payment.invoice_id,
      payment_type: payment.payment_type as PaymentType,
      reference_id: payment.reference_id,
      base_amount: payment.base_amount,
      tax_amount: payment.tax_amount,
      total_amount: payment.total_amount,
      tax_config_id: payment.tax_config_id ?? undefined,
      tax_rate_percent: payment.tax_rate_percent ?? undefined,
      tax_type: payment.tax_type ? (payment.tax_type as 'VAT' | 'GST' | 'SALES_TAX' | 'OTHER') : undefined,
      payment_date: payment.payment_date ?? undefined,
      payment_method: payment.payment_method as 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE',
      payment_ref_number: payment.payment_ref_number ?? undefined,
      status: payment.status as PaymentStatus,
      due_date: payment.due_date,
      payment_received_date: payment.payment_received_date ?? undefined,
      notes: payment.notes ?? undefined,
      invoice: payment.invoice ? {
        id: payment.invoice.id,
        invoice_number: payment.invoice.invoice_number,
        total_amount: payment.invoice.total_amount,
      } : null,
      created_at: payment.createdAt,
      updated_at: payment.updatedAt,
    };
  }

  /**
   * Map invoice to DTO
   */
  private mapInvoiceToDTO(invoice: PrismaInvoiceModel): Invoice {
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      issued_by_site_id: invoice.site_id,
      items: (invoice.items || []).map((item) => ({
        id: item.id,
        invoice_id: item.invoice_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        tax_config_id: item.tax_config_id ?? undefined,
        tax_rate_percent: item.tax_rate_percent ?? undefined,
        line_tax: item.line_tax,
        item_type: item.item_type as PaymentType,
        reference_id: item.reference_id ?? undefined,
      })),
      subtotal: invoice.subtotal,
      total_tax: invoice.total_tax,
      total_amount: invoice.total_amount,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      status: invoice.status as 'DRAFT' | 'ISSUED' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED',
      description: invoice.description ?? undefined,
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt,
    };
  }
}

const paymentServiceInstance = new PaymentService();
export default paymentServiceInstance;
