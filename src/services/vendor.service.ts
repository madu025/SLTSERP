import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface CreateVendorInput {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  registrationNo?: string | null;
  brNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNo?: string | null;
  status?: string;
  type?: string;
  paymentTerms?: string | null;
  rating?: string | number | null;
  notes?: string | null;
}

export class VendorService {
  /**
   * List all vendors with optional search query
   */
  static async getVendors(search?: string | null) {
    const where: Prisma.VendorWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a new vendor with auto-generated incremental code
   */
  static async createVendor(data: CreateVendorInput) {
    const { name } = data;

    if (!name || !name.trim()) {
      throw new Error('NAME_REQUIRED');
    }

    // Check unique name (case-insensitive)
    const existingVendor = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existingVendor) {
      throw new Error('VENDOR_EXISTS');
    }

    // Generate code "VND-XXXXX"
    const lastVendor = await prisma.vendor.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextCode: string;
    if (lastVendor && lastVendor.code) {
      const lastNumber = parseInt(lastVendor.code.replace('VND-', ''), 10);
      const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
      nextCode = 'VND-' + String(nextNumber).padStart(5, '0');
    } else {
      nextCode = 'VND-00001';
    }

    return prisma.vendor.create({
      data: {
        code: nextCode,
        name: name.trim(),
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        registrationNo: data.registrationNo || null,
        brNumber: data.brNumber || null,
        bankName: data.bankName || null,
        bankBranch: data.bankBranch || null,
        bankAccountNo: data.bankAccountNo || null,
        status: data.status || 'ACTIVE',
        type: data.type || 'SUPPLIER',
        paymentTerms: data.paymentTerms || null,
        rating: data.rating != null ? parseInt(String(data.rating), 10) : null,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Get vendor details by ID
   */
  static async getVendorById(id: string) {
    return prisma.vendor.findUnique({
      where: { id },
    });
  }

  /**
   * Update vendor details
   */
  static async updateVendor(id: string, data: Partial<CreateVendorInput>) {
    return prisma.vendor.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        contactPerson: data.contactPerson !== undefined ? data.contactPerson : undefined,
        email: data.email !== undefined ? data.email : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        address: data.address !== undefined ? data.address : undefined,
        registrationNo: data.registrationNo !== undefined ? data.registrationNo : undefined,
        brNumber: data.brNumber !== undefined ? data.brNumber : undefined,
        bankName: data.bankName !== undefined ? data.bankName : undefined,
        bankBranch: data.bankBranch !== undefined ? data.bankBranch : undefined,
        bankAccountNo: data.bankAccountNo !== undefined ? data.bankAccountNo : undefined,
        status: data.status !== undefined ? data.status : undefined,
        type: data.type !== undefined ? data.type : undefined,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : undefined,
        rating: data.rating !== undefined && data.rating !== null ? parseInt(String(data.rating), 10) : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
    });
  }

  /**
   * Soft delete / deactivate vendor
   */
  static async deleteVendor(id: string) {
    return prisma.vendor.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
