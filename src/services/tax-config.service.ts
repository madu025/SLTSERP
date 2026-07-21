import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { TaxTypeEnum } from '@prisma/client';

export interface CreateTaxConfigInput {
  tax_name: string;
  tax_type: string;
  tax_rate_percent: string | number;
  effective_from_date: string | Date;
  effective_to_date?: string | Date | null;
  applicable_to?: any;
  tax_inclusive?: boolean;
  tax_exempt_items?: string | null;
  status?: string;
}

export class TaxConfigService {
  /**
   * Get tax configurations filtered by status
   */
  static async getTaxConfigs(status: string = 'ACTIVE') {
    return prisma.vMTaxConfig.findMany({
      where: { status },
      orderBy: { effective_from_date: 'desc' },
    });
  }

  /**
   * Create a new tax configuration
   */
  static async createTaxConfig(data: CreateTaxConfigInput) {
    const {
      tax_name,
      tax_type,
      tax_rate_percent,
      effective_from_date,
      effective_to_date,
      applicable_to,
      tax_inclusive,
      tax_exempt_items,
      status,
    } = data;

    if (!tax_name || !tax_type || tax_rate_percent === undefined || tax_rate_percent === null || !effective_from_date) {
      throw AppError.badRequest('MISSING_REQUIRED_FIELDS');
    }

    if (!Object.values(TaxTypeEnum).includes(tax_type as TaxTypeEnum)) {
      throw AppError.badRequest('INVALID_TAX_TYPE');
    }

    return prisma.vMTaxConfig.create({
      data: {
        tax_name,
        tax_type: tax_type as TaxTypeEnum,
        tax_rate_percent: parseFloat(String(tax_rate_percent)),
        effective_from_date: new Date(effective_from_date),
        effective_to_date: effective_to_date ? new Date(effective_to_date) : null,
        applicable_to: applicable_to ? JSON.stringify(applicable_to) : '[]',
        tax_inclusive: tax_inclusive || false,
        tax_exempt_items: tax_exempt_items || null,
        status: status || 'ACTIVE',
      },
    });
  }
}
