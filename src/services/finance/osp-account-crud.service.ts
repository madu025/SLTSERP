import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { OSPLedgerService } from './osp-ledger.service';

export class OSPAccountCrudService {
  // ==========================================
  // 1. Petty Cash IOUs
  // ==========================================

  static async createIOU(data: {
    iouNumber: string;
    opmcId?: string;
    staffName: string;
    staffServiceNo?: string;
    type?: string;
    amount: number;
    issuedDate?: Date;
    reason?: string;
    noOfDays?: number;
    remarks?: string;
  }) {
    if (data.amount <= 0) throw AppError.badRequest('AMOUNT_MUST_BE_GREATER_THAN_ZERO');

    const existing = await prisma.ospPettyCashIou.findUnique({
      where: {
        iouNumber_staffName: {
          iouNumber: data.iouNumber,
          staffName: data.staffName
        }
      }
    });

    if (existing) {
      throw AppError.badRequest('IOU_ALREADY_EXISTS_FOR_STAFF');
    }

    return await prisma.ospPettyCashIou.create({
      data: {
        ...data,
        status: 'PENDING'
      }
    });
  }

  static async approveIOU(id: string) {
    return await prisma.$transaction(async (tx) => {
      const iou = await tx.ospPettyCashIou.findUnique({ where: { id } });
      if (!iou) throw AppError.notFound('IOU_NOT_FOUND');
      if (iou.status === 'APPROVED') throw AppError.badRequest('ALREADY_APPROVED');

      const updated = await tx.ospPettyCashIou.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() }
      });

      await OSPLedgerService.postAutomatedTransaction(tx, {
        sourceModule: 'OSP_IOU',
        transactionType: 'ISSUE_ADVANCE',
        referenceId: iou.id,
        description: `Petty Cash IOU for ${iou.staffName} (${iou.iouNumber})`,
        amount: iou.amount,
        transactionDate: new Date(),
      });

      return updated;
    });
  }

  static async rejectIOU(id: string, reason?: string) {
    const iou = await prisma.ospPettyCashIou.findUnique({ where: { id } });
    if (!iou) throw AppError.notFound('IOU_NOT_FOUND');
    
    return await prisma.ospPettyCashIou.update({
      where: { id },
      data: { 
        status: 'REJECTED',
        remarks: reason ? `${iou.remarks || ''} [Rejected: ${reason}]`.trim() : iou.remarks
      }
    });
  }

  static async getIOUs() {
    return await prisma.ospPettyCashIou.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // ==========================================
  // 2. Project Advances
  // ==========================================

  static async getAdvances() {
    return await prisma.ospProjectAdvance.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createAdvance(data: {
    refNumber: string;
    type?: string;
    supplierName?: string;
    description: string;
    invoiceNo?: string;
    amount: number;
    vatAmount?: number;
    opmcId?: string;
  }) {
    if (data.amount <= 0) throw AppError.badRequest('AMOUNT_MUST_BE_GREATER_THAN_ZERO');

    const existing = await prisma.ospProjectAdvance.findUnique({
      where: { refNumber: data.refNumber }
    });

    if (existing) {
      throw AppError.badRequest('ADVANCE_REF_ALREADY_EXISTS');
    }

    const totalAmount = data.amount + (data.vatAmount || 0);

    return await prisma.ospProjectAdvance.create({
      data: {
        ...data,
        totalAmount,
        status: 'PENDING'
      }
    });
  }

  static async approveAdvance(id: string) {
    return await prisma.$transaction(async (tx) => {
      const adv = await tx.ospProjectAdvance.findUnique({ where: { id } });
      if (!adv) throw AppError.notFound('ADVANCE_NOT_FOUND');
      if (adv.status === 'APPROVED') throw AppError.badRequest('ALREADY_APPROVED');

      const updated = await tx.ospProjectAdvance.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() }
      });

      await OSPLedgerService.postAutomatedTransaction(tx, {
        sourceModule: 'OSP_ADVANCE',
        transactionType: 'ISSUE_ADVANCE',
        referenceId: adv.id,
        description: `Project Advance for ${adv.supplierName || 'Supplier'} (${adv.refNumber})`,
        amount: adv.amount, // base amount? Or totalAmount? totalAmount typically used for finance.
        transactionDate: new Date(),
      });

      return updated;
    });
  }

  static async rejectAdvance(id: string) {
    const adv = await prisma.ospProjectAdvance.findUnique({ where: { id } });
    if (!adv) throw AppError.notFound('ADVANCE_NOT_FOUND');
    
    return await prisma.ospProjectAdvance.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
  }

  // ==========================================
  // 3. Property & Office Rent
  // ==========================================

  static async createRentPayment(data: {
    accountNo?: string;
    supplierName: string;
    amount: number;
    category?: string;
    slipNo: string;
    slipDate?: Date;
    opmcId?: string;
  }) {
    if (data.amount <= 0) throw AppError.badRequest('AMOUNT_MUST_BE_GREATER_THAN_ZERO');

    const existing = await prisma.ospPropertyRentPayment.findUnique({
      where: {
        supplierName_slipNo: {
          supplierName: data.supplierName,
          slipNo: data.slipNo
        }
      }
    });

    if (existing) {
      throw AppError.badRequest('RENT_PAYMENT_ALREADY_EXISTS_FOR_SLIP');
    }

    return await prisma.ospPropertyRentPayment.create({
      data: {
        ...data,
        status: 'PENDING'
      }
    });
  }

  static async approveRentPayment(id: string) {
    return await prisma.$transaction(async (tx) => {
      const rent = await tx.ospPropertyRentPayment.findUnique({ where: { id } });
      if (!rent) throw AppError.notFound('RENT_PAYMENT_NOT_FOUND');
      if (rent.status === 'APPROVED') throw AppError.badRequest('ALREADY_APPROVED');

      const updated = await tx.ospPropertyRentPayment.update({
        where: { id },
        data: { 
          status: 'APPROVED',
          approvedAt: new Date()
        }
      });

      await OSPLedgerService.postAutomatedTransaction(tx, {
        sourceModule: 'OSP_RENT',
        transactionType: 'PAY_RENT',
        referenceId: rent.id,
        description: `Property Rent Payment to ${rent.supplierName} (${rent.slipNo})`,
        amount: rent.amount,
        transactionDate: rent.slipDate || new Date(),
      });

      return updated;
    });
  }

  static async rejectRentPayment(id: string) {
    const rent = await prisma.ospPropertyRentPayment.findUnique({ where: { id } });
    if (!rent) throw AppError.notFound('RENT_PAYMENT_NOT_FOUND');
    
    return await prisma.ospPropertyRentPayment.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
  }

  static async getRentPayments() {
    return await prisma.ospPropertyRentPayment.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // ==========================================
  // 4. Fuel Deposit Ledger
  // ==========================================

  static async createFuelDeposit(data: {
    officeLocation: string;
    stationName: string;
    actualDeposit: number;
    opmcId?: string;
  }) {
    if (data.actualDeposit <= 0) throw AppError.badRequest('DEPOSIT_MUST_BE_GREATER_THAN_ZERO');

    const existing = await prisma.ospFuelDepositLedger.findUnique({
      where: {
        officeLocation_stationName: {
          officeLocation: data.officeLocation,
          stationName: data.stationName
        }
      }
    });

    if (existing) {
      // If it exists, we might want to update or throw error. Native CRUD usually means explicit updates.
      throw AppError.badRequest('FUEL_DEPOSIT_ALREADY_EXISTS_FOR_LOCATION');
    }

    return await prisma.ospFuelDepositLedger.create({
      data: {
        ...data,
        status: 'PENDING'
      }
    });
  }

  static async approveFuelDeposit(id: string) {
    const deposit = await prisma.ospFuelDepositLedger.findUnique({ where: { id } });
    if (!deposit) throw AppError.notFound('FUEL_DEPOSIT_NOT_FOUND');
    if (deposit.status === 'APPROVED') throw AppError.badRequest('ALREADY_APPROVED');

    return await prisma.ospFuelDepositLedger.update({
      where: { id },
      data: { 
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });
  }

  static async rejectFuelDeposit(id: string) {
    const deposit = await prisma.ospFuelDepositLedger.findUnique({ where: { id } });
    if (!deposit) throw AppError.notFound('FUEL_DEPOSIT_NOT_FOUND');
    
    return await prisma.ospFuelDepositLedger.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
  }

  static async getFuelDeposits() {
    return await prisma.ospFuelDepositLedger.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // ==========================================
  // 5. Vehicle Hiring Payments
  // ==========================================

  static async createHiringPayment(data: {
    vehicleNo?: string;
    bankCode?: string;
    accountNo?: string;
    accountName: string;
    amount: number;
    slipNo: string;
    slipDate?: Date;
    paidDate?: Date;
    opmcId?: string;
  }) {
    if (data.amount <= 0) throw AppError.badRequest('AMOUNT_MUST_BE_GREATER_THAN_ZERO');

    const existing = await prisma.ospVehicleHiringPayment.findUnique({
      where: {
        accountName_slipNo: {
          accountName: data.accountName,
          slipNo: data.slipNo
        }
      }
    });

    if (existing) {
      throw AppError.badRequest('HIRING_PAYMENT_ALREADY_EXISTS_FOR_SLIP');
    }

    return await prisma.ospVehicleHiringPayment.create({
      data: {
        ...data,
        status: 'PENDING'
      }
    });
  }

  static async approveHiringPayment(id: string) {
    const payment = await prisma.ospVehicleHiringPayment.findUnique({ where: { id } });
    if (!payment) throw AppError.notFound('HIRING_PAYMENT_NOT_FOUND');
    if (payment.status === 'APPROVED') throw AppError.badRequest('ALREADY_APPROVED');

    return await prisma.ospVehicleHiringPayment.update({
      where: { id },
      data: { 
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });
  }

  static async rejectHiringPayment(id: string) {
    const payment = await prisma.ospVehicleHiringPayment.findUnique({ where: { id } });
    if (!payment) throw AppError.notFound('HIRING_PAYMENT_NOT_FOUND');
    
    return await prisma.ospVehicleHiringPayment.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
  }

  static async getHiringPayments() {
    return await prisma.ospVehicleHiringPayment.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
