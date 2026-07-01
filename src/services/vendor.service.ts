import { prisma } from '@/lib/prisma';

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
    const where: any = {};

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
}
