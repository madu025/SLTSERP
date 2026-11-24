import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { LedgerService } from './ledger.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { boxSummary, canCancelVoucher, checkOpening } from '@/lib/petty-cash-rules';
import { assertSiteOfficeAccess, siteOfficeCode, siteOfficeScope } from '@/lib/site-office-access';

/** Petty cash belongs to a site office; a box made before site offices still belongs to its OPMC. */
async function assertPettyCashOpmcAccess(actorId: string | null | undefined, opmcId: string | null | undefined) {
  const scope = await resolveOpmcScope(actorId, 'finance');
  if (scope !== undefined && (!opmcId || !scope.includes(opmcId))) {
    throw AppError.forbidden('OPMC_SCOPE_VIOLATION: Petty cash account is outside your OPMC scope.');
  }
}
async function assertBoxAccess(actorId: string | null | undefined, box: { siteOfficeId?: string | null; opmcId?: string | null }) {
  if (box.siteOfficeId) return assertSiteOfficeAccess(actorId, box.siteOfficeId);
  return assertPettyCashOpmcAccess(actorId, box.opmcId);
}
/** The code of a box in document numbers: its site office, or the RTOM of a box made before site offices. */
async function boxCode(box: { siteOfficeId?: string | null; opmc?: { rtom: string } | null }): Promise<string> {
  if (box.siteOfficeId) {
    const store = await prisma.inventoryStore.findUnique({ where: { id: box.siteOfficeId }, select: { name: true } });
    return siteOfficeCode(store?.name ?? 'SITE');
  }
  return box.opmc?.rtom ?? 'PC';
}

export class PettyCashService {
  /**
   * Create a new petty cash account for an OPMC (imprest limit setup)
   */
  static async createPettyCashAccount(data: {
    name: string;
    siteOfficeId: string;
    imprestLimit: number;
    /** what is really in the box now (default 0: Head Office funds the float with a funding request) */
    openingBalance?: number;
    createdById: string;
  }) {
    if (data.imprestLimit <= 0) {
      throw AppError.badRequest('INVALID_IMPREST_LIMIT');
    }
    const opening = data.openingBalance ?? 0;
    const openingCheck = checkOpening(data.imprestLimit, opening);
    if (!openingCheck.ok) throw AppError.badRequest(`INVALID_OPENING_BALANCE: ${openingCheck.message}`);

    await assertSiteOfficeAccess(data.createdById, data.siteOfficeId);
    const store = await prisma.inventoryStore.findUnique({ where: { id: data.siteOfficeId }, select: { id: true, type: true } });
    if (!store || !['MAIN', 'SUB'].includes(store.type)) throw AppError.badRequest('SITE_OFFICE_NOT_FOUND');

    // one box for each site office
    const existing = await prisma.pettyCashAccount.findUnique({
      where: { siteOfficeId: data.siteOfficeId }
    });
    if (existing) {
      throw AppError.badRequest('PETTY_CASH_ACCOUNT_ALREADY_EXISTS_FOR_SITE_OFFICE');
    }

    return await prisma.pettyCashAccount.create({
      data: {
        name: data.name,
        siteOfficeId: data.siteOfficeId,
        imprestLimit: data.imprestLimit,
        currentBalance: opening, // what is in the box; the float comes from Head Office as a funding request, not from nowhere
        createdById: data.createdById,
        status: 'ACTIVE'
      }
    });
  }

  /**
   * List all petty cash accounts
   */
  static async getPettyCashAccounts(actorId?: string | null) {
    const offices = actorId ? await siteOfficeScope(actorId) : undefined;
    const opmcs = actorId ? await resolveOpmcScope(actorId, 'finance') : undefined;
    return prisma.pettyCashAccount.findMany({
      where: offices === undefined ? undefined : { OR: [{ siteOfficeId: { in: offices } }, { siteOfficeId: null, opmcId: { in: opmcs ?? [] } }] },
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
    if (account && actorId) await assertBoxAccess(actorId, account);
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
    await assertBoxAccess(data.createdById, account);
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

    const voucherNumber = `PCV-${await boxCode(account)}-${year}-${(count + 1).toString().padStart(4, '0')}`;

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
   * Every box in the caller's scope with its figures: cash in hand, cash out on open IOUs, bills waiting to be reimbursed, and the replenishment they ask for.
   */
  static async getSummaries(actorId?: string | null) {
    const accounts = await this.getPettyCashAccounts(actorId);
    if (accounts.length === 0) return [];
    const stores = await prisma.inventoryStore.findMany({ where: { id: { in: accounts.map((a) => a.siteOfficeId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const ids = accounts.map((a) => a.id);
    const [ious, bills, drafts, pending, floats] = await Promise.all([
      prisma.ospPettyCashIou.findMany({ where: { pettyCashAccountId: { in: ids }, status: 'APPROVED' }, select: { pettyCashAccountId: true, amount: true, settledAmount: true } }),
      prisma.pettyCashVoucher.groupBy({ by: ['accountId'], where: { accountId: { in: ids }, status: 'APPROVED' }, _sum: { amount: true } }),
      prisma.pettyCashVoucher.groupBy({ by: ['accountId'], where: { accountId: { in: ids }, status: 'DRAFT' }, _count: { _all: true } }),
      prisma.pettyCashReimbursement.findMany({ where: { accountId: { in: ids }, status: 'PENDING' }, select: { accountId: true, reimbursementNumber: true, totalAmount: true } }),
      // a float already asked of Head Office and not yet funded: it must not be asked for twice
      prisma.hoFundingRequest.findMany({ where: { pettyCashAccountId: { in: ids }, purpose: 'PETTY_CASH_FLOAT', status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } }, select: { pettyCashAccountId: true, requestedAmount: true, approvedAmount: true, status: true } }),
    ]);
    return accounts.map((a) => {
      const iouOut = ious.filter((i) => i.pettyCashAccountId === a.id).reduce((x, i) => x + Math.max(0, Number(i.amount) - Number(i.settledAmount)), 0);
      const billsWaiting = Number(bills.find((b) => b.accountId === a.id)?._sum.amount ?? 0);
      const figures = boxSummary({ limit: Number(a.imprestLimit), balance: Number(a.currentBalance), iouOut: Math.round(iouOut * 100) / 100, billsWaiting });
      const floatPending = Math.round(floats.filter((f) => f.pettyCashAccountId === a.id).reduce((x, f) => x + Number(f.status === 'APPROVED' ? f.approvedAmount : f.requestedAmount), 0) * 100) / 100;
      return {
        id: a.id, name: a.name, siteOfficeId: a.siteOfficeId, opmcId: a.opmcId, site: stores.find((x) => x.id === a.siteOfficeId)?.name ?? a.opmc?.name ?? a.opmc?.rtom ?? '', status: a.status, ...figures,
        floatPending, floatRoom: Math.max(0, Math.round((figures.unaccounted - floatPending) * 100) / 100),
        draftBills: drafts.find((d) => d.accountId === a.id)?._count._all ?? 0,
        pendingReimbursement: pending.find((r) => r.accountId === a.id) ?? null,
      };
    });
  }

  /** Cancel a draft bill with a reason, and the number of the bill it was carried to when there is one. */
  static async cancelVoucher(voucherId: string, reason: string, carriedToNumber: string | null | undefined, actorId: string) {
    if (!reason || reason.trim().length < 3) throw AppError.badRequest('CANCEL_REASON_REQUIRED');
    const voucher = await prisma.pettyCashVoucher.findUnique({ where: { id: voucherId }, include: { account: { select: { opmcId: true, siteOfficeId: true } } } });
    if (!voucher) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    await assertBoxAccess(actorId, voucher.account);
    if (!canCancelVoucher(voucher.status)) throw AppError.badRequest(`VOUCHER_CANNOT_BE_CANCELLED: a ${voucher.status.toLowerCase()} bill is already in the books`);
    const cancelled = await prisma.pettyCashVoucher.updateMany({ where: { id: voucherId, status: 'DRAFT' }, data: { status: 'CANCELLED', cancelledReason: reason.trim(), cancelledAt: new Date(), carriedToNumber: carriedToNumber?.trim() || null } });
    if (cancelled.count !== 1) throw AppError.conflict('VOUCHER_ALREADY_PROCESSED');
    await prisma.auditLog.create({ data: { action: 'CANCEL_VOUCHER', entity: 'PETTY_CASH_VOUCHER', entityId: voucherId, userId: actorId, newValue: { reason: reason.trim(), carriedToNumber: carriedToNumber?.trim() || null }, ipAddress: 'SYSTEM', userAgent: 'SYSTEM' } });
    return prisma.pettyCashVoucher.findUniqueOrThrow({ where: { id: voucherId } });
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
      await assertBoxAccess(approvedById, account);
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
      include: { account: { select: { opmcId: true, siteOfficeId: true } } }
    });
    if (!voucher) throw AppError.badRequest('VOUCHER_NOT_FOUND');
    await assertBoxAccess(approvedById, voucher.account);
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
      await assertBoxAccess(createdById, account);

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
      const reimbursementNumber = `PCR-${await boxCode(account)}-${year}-${(count + 1).toString().padStart(4, '0')}`;

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

      // 3. The replenishment is asked of Head Office: it is approved and funded there, and funding completes the reimbursement
      const { AuditLedgerService } = await import('@/services/inventory/audit-ledger.service');
      const requestNumber = await AuditLedgerService.getNextDocumentNumber('HFR', tx);
      await tx.hoFundingRequest.create({
        data: {
          requestNumber, purpose: 'PETTY_CASH_REPLENISH', status: 'SUBMITTED', requestedAmount: totalAmount, pettyCashAccountId: accountId,
          reimbursementId: reimbursement.id, remarks: `Replenish ${account.name} (${reimbursementNumber})`, createdById, submittedAt: new Date(),
        },
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
      await assertBoxAccess(userId, reimbursement.account);
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
    const offices = actorId ? await siteOfficeScope(actorId) : undefined;
    const opmcs = actorId ? await resolveOpmcScope(actorId, 'finance') : undefined;
    if (accountId) {
      const account = await prisma.pettyCashAccount.findUnique({
        where: { id: accountId }
      });
      if (!account) throw AppError.badRequest('PETTY_CASH_ACCOUNT_NOT_FOUND');
      if (actorId) await assertBoxAccess(actorId, account);
      return prisma.pettyCashReimbursement.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' }
      });
    }

    return prisma.pettyCashReimbursement.findMany({
      where: offices === undefined ? undefined : { account: { OR: [{ siteOfficeId: { in: offices } }, { siteOfficeId: null, opmcId: { in: opmcs ?? [] } }] } },
      include: {
        account: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
