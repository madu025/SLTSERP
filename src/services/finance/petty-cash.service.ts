import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/** Petty cash is per OPMC: the actor must be global or have the account's OPMC in scope. */
async function assertPettyCashOpmcAccess(actorId: string | null | undefined, opmcId: string) {
  const scope = await resolveOpmcScope(actorId);
  if (scope !== undefined && !scope.includes(opmcId)) {
    throw AppError.forbidden('OPMC_SCOPE_VIOLATION: Petty cash account is outside your OPMC scope.');
  }
}

export class PettyCashService {
  /**
   * Create a new petty cash account for an OPMC (imprest limit setup)
   */
  static async createPettyCashAccount(data: {
    name: string;
    opmcId: string;
    imprestLimit: number;
    createdById: string;
  }) {
    if (data.imprestLimit <= 0) {
      throw AppError.badRequest('INVALID_IMPREST_LIMIT');
    }

    await assertPettyCashOpmcAccess(data.createdById, data.opmcId);

    // Check if account already exists for OPMC
    const existing = await prisma.pettyCashAccount.findUnique({
      where: { opmcId: data.opmcId }
    });
    if (existing) {
      throw AppError.badRequest('PETTY_CASH_ACCOUNT_ALREADY_EXISTS_FOR_OPMC');
    }

    return await prisma.pettyCashAccount.create({
      data: {
        name: data.name,
        opmcId: data.opmcId,
        imprestLimit: data.imprestLimit,
        currentBalance: data.imprestLimit, // initially full limit
        createdById: data.createdById,
        status: 'ACTIVE'
      }
    });
  }

  /**
   * List all petty cash accounts
   */
  static async getPettyCashAccounts(actorId?: string | null) {
    const scope = actorId ? await resolveOpmcScope(actorId) : undefined;
    return prisma.pettyCashAccount.findMany({
      where: scope === undefined ? undefined : { opmcId: { in: scope.length > 0 ? scope : ['00000000-0000-0000-0000-000000000000'] } },
      include: {
        opmc: {
          select: { name: true, rtom: true }
        }
      }
    });
  }

  /**
   * Get petty cash account by ID or OPMC ID
   */
  static async getPettyCashAccount(id: string, actorId?: string | null) {
    const account = await prisma.pettyCashAccount.findUnique({
      where: { id },
      include: {
        opmc: true,
        vouchers: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (account && actorId) await assertPettyCashOpmcAccess(actorId, account.opmcId);
    return account;
  }

  /**
   * Create a new petty cash voucher (Draft)
   */
  static async createVoucher(data: {
    accountId: string;
    title: string;
    amount: number;
    category: string;
    description?: string | null;
    recipientName?: string | null;
    receiptUrl?: string | null;
    createdById: string;
  }) {
    if (data.amount <= 0) {
      throw AppError.badRequest('INVALID_VOUCHER_AMOUNT');
    }

    const account = await prisma.pettyCashAccount.findUnique({
      where: { id: data.accountId },
      include: { opmc: true }
    });
    if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
    await assertPettyCashOpmcAccess(data.createdById, account.opmcId);
    if (account.status !== 'ACTIVE') throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_ACTIVE');

    if (data.amount > Number(account.imprestLimit)) {
      throw AppError.badRequest('VOUCHER_AMOUNT_EXCEEDS_IMPREST_LIMIT');
    }

    // Generate Voucher Number: PCV-[RTOM]-[YEAR]-[COUNT]
    const year = new Date().getFullYear();
    const count = await prisma.pettyCashVoucher.count({
      where: {
        accountId: data.accountId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });

    const voucherNumber = `PCV-${account.opmc.rtom}-${year}-${(count + 1).toString().padStart(4, '0')}`;

    return prisma.pettyCashVoucher.create({
      data: {
        accountId: data.accountId,
        voucherNumber,
        title: data.title,
        amount: data.amount,
        category: data.category,
        description: data.description || null,
        recipientName: data.recipientName || null,
        receiptUrl: data.receiptUrl || null,
        createdById: data.createdById,
        status: 'DRAFT'
      }
    });
  }

  /**
   * Approve a Petty Cash Voucher
   * Lowers the petty cash account currentBalance and logs double-entry in General Ledger
   */
  static async approveVoucher(voucherId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const voucher = await tx.pettyCashVoucher.findUnique({
        where: { id: voucherId },
        include: { account: true }
      });
      if (!voucher) throw AppError.badRequest('VOUCHER_NOT_FOUND');
      if (voucher.status !== 'DRAFT') throw AppError.badRequest('VOUCHER_ALREADY_PROCESSED');

      const account = voucher.account;
      await assertPettyCashOpmcAccess(approvedById, account.opmcId);
      if (voucher.createdById === approvedById) throw AppError.badRequest('MAKER_CANNOT_APPROVE_OWN_VOUCHER');
      if (account.status !== 'ACTIVE') throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_ACTIVE');

      // Check if enough funds in petty cash
      if (new Prisma.Decimal(account.currentBalance).lt(new Prisma.Decimal(voucher.amount))) {
        throw AppError.badRequest('INSUFFICIENT_PETTY_CASH_BALANCE');
      }

      // 1. Update Voucher Status
      const updatedVoucher = await tx.pettyCashVoucher.update({
        where: { id: voucherId },
        data: {
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date()
        }
      });

      // 2. Decrease Current Balance
      await tx.pettyCashAccount.update({
        where: { id: account.id },
        data: {
          currentBalance: Number(account.currentBalance) - Number(voucher.amount)
        }
      });

      // 3. Log double-entry transaction
      await LedgerService.logPettyCashExpense(tx, voucherId, Number(voucher.amount), voucher.category, `Petty Cash: ${voucher.title}`);

      return updatedVoucher;
    });
  }

  /**
   * Reject a Petty Cash Voucher
   */
  static async rejectVoucher(voucherId: string, rejectionReason: string, approvedById: string) {
    const voucher = await prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { account: { select: { opmcId: true } } }
    });
    if (!voucher) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    await assertPettyCashOpmcAccess(approvedById, voucher.account.opmcId);
    if (voucher.createdById === approvedById) throw AppError.badRequest('MAKER_CANNOT_REJECT_OWN_VOUCHER');
    if (voucher.status !== 'DRAFT') throw AppError.badRequest('VOUCHER_ALREADY_PROCESSED');

    return prisma.pettyCashVoucher.update({
      where: { id: voucherId },
      data: {
        status: 'REJECTED',
        rejectionReason,
        approvedById,
        approvedAt: new Date()
      }
    });
  }

  /**
   * Request replenishment (reimbursement) from Head Office
   * Groups all APPROVED vouchers into a new PettyCashReimbursement request
   */
  static async requestReimbursement(accountId: string, createdById: string) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.pettyCashAccount.findUnique({
        where: { id: accountId },
        include: { opmc: true }
      });
      if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
      await assertPettyCashOpmcAccess(createdById, account.opmcId);

      const pendingReimbursement = await tx.pettyCashReimbursement.findFirst({
        where: { accountId, status: 'PENDING' }
      });
      if (pendingReimbursement) {
        throw AppError.badRequest('PENDING_REIMBURSEMENT_EXISTS');
      }

      // Get all APPROVED vouchers not currently in a reimbursement
      const eligibleVouchers = await tx.pettyCashVoucher.findMany({
        where: {
          accountId,
          status: 'APPROVED',
          reimbursementId: null
        }
      });

      if (eligibleVouchers.length === 0) {
        throw AppError.badRequest('NO_APPROVED_VOUCHERS_FOR_REIMBURSEMENT');
      }

      const totalAmount = eligibleVouchers.reduce((sum, v) => sum + Number(v.amount), 0);

      // Generate Reimbursement Request Number
      const year = new Date().getFullYear();
      const count = await tx.pettyCashReimbursement.count({
        where: { accountId }
      });
      const reimbursementNumber = `PCR-${account.opmc.rtom}-${year}-${(count + 1).toString().padStart(4, '0')}`;

      // 1. Create Reimbursement Request
      const reimbursement = await tx.pettyCashReimbursement.create({
        data: {
          accountId,
          reimbursementNumber,
          totalAmount,
          status: 'PENDING',
          createdById
        }
      });

      // 2. Link Vouchers
      await tx.pettyCashVoucher.updateMany({
        where: {
          id: { in: eligibleVouchers.map(v => v.id) }
        },
        data: {
          reimbursementId: reimbursement.id
        }
      });

      return reimbursement;
    });
  }

  /**
   * Complete the Reimbursement (Replenishment)
   * Resets the petty cash account currentBalance to imprestLimit, links the Head Office Payment Voucher,
   * and logs double-entry (Debit PettyCash, Credit Bank)
   */
  static async completeReimbursement(reimbursementId: string, paymentVoucherId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const reimbursement = await tx.pettyCashReimbursement.findUnique({
        where: { id: reimbursementId },
        include: { account: true, vouchers: true }
      });
      if (!reimbursement) throw AppError.badRequest('REIMBURSEMENT_NOT_FOUND');
      if (reimbursement.status !== 'PENDING') throw AppError.badRequest('REIMBURSEMENT_ALREADY_PROCESSED');
      await assertPettyCashOpmcAccess(userId, reimbursement.account.opmcId);
      if (reimbursement.createdById === userId) throw AppError.badRequest('MAKER_CANNOT_COMPLETE_OWN_REIMBURSEMENT');

      // The reimbursement must be backed by a real, paid payment voucher
      const pv = await tx.paymentVoucher.findUnique({ where: { id: paymentVoucherId }, select: { status: true } });
      if (!pv) throw AppError.badRequest('PAYMENT_VOUCHER_NOT_FOUND');
      if (pv.status !== 'PAID') throw AppError.badRequest('PAYMENT_VOUCHER_NOT_PAID');

      // 1. Update Reimbursement status
      const updatedReimbursement = await tx.pettyCashReimbursement.update({
        where: { id: reimbursementId },
        data: {
          status: 'REIMBURSED',
          paymentVoucherId
        }
      });

      // 2. Update Vouchers to REIMBURSED
      await tx.pettyCashVoucher.updateMany({
        where: { reimbursementId },
        data: { status: 'REIMBURSED' }
      });

      // 3. Replenish Current Balance in Petty Cash Account
      // Instead of blindly resetting to the imprest limit, we ADD the reimbursement amount
      // to the current balance to avoid overwriting any expenses approved during the pending window.
      // We cap it at the imprest limit to ensure mathematical logic checks out.
      const newBalance = Math.min(
        Number(reimbursement.account.imprestLimit),
        Number(reimbursement.account.currentBalance) + Number(reimbursement.totalAmount)
      );
      await tx.pettyCashAccount.update({
        where: { id: reimbursement.accountId },
        data: {
          currentBalance: newBalance
        }
      });

      // 4. Log funding entry in general ledger
      await LedgerService.logPettyCashReimbursement(tx, reimbursementId, Number(reimbursement.totalAmount), `Replenish Petty Cash Imprest for ${reimbursement.account.name}`);

      return updatedReimbursement;
    });
  }

  /**
   * Get petty cash reimbursements
   */
  static async getReimbursements(accountId?: string, actorId?: string | null) {
    const scope = actorId ? await resolveOpmcScope(actorId) : undefined;
    if (accountId) {
      const account = await prisma.pettyCashAccount.findUnique({
        where: { id: accountId }
      });
      if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
      if (actorId) await assertPettyCashOpmcAccess(actorId, account.opmcId);
      return prisma.pettyCashReimbursement.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' }
      });
    }

    return prisma.pettyCashReimbursement.findMany({
      where: scope === undefined ? undefined : { account: { opmcId: { in: scope.length > 0 ? scope : ['00000000-0000-0000-0000-000000000000'] } } },
      include: {
        account: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
