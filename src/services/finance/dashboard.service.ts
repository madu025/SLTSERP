import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NIL_UUID } from '@/lib/opmc-scope';

export class FinanceDashboardService {
  /**
   * Aggregate financial summary metrics for dashboard widgets.
   *
   * Scope parameters follow the same tri-state pattern used by
   * DashboardService.getFinanceMetrics:
   *  - rtom: specific RTOM filter or 'ALL'
   *  - accessibleOpmcs: undefined = admin (no filter), [] = deny all,
   *    [ids] = restrict to these OPMC IDs (resolved to RTOMs for Invoice).
   */
  static async getDashboardMetrics(rtom: string = 'ALL', accessibleOpmcs?: string[]) {
    const today = new Date();

    // ── Resolve RTOM scope for Invoice queries ─────────────────────────
    let scopedRtoms: string[] | undefined;
    if (accessibleOpmcs !== undefined) {
      scopedRtoms = accessibleOpmcs.length > 0
        ? (await prisma.oPMC.findMany({
            where: { id: { in: accessibleOpmcs } },
            select: { rtom: true }
          })).map(o => o.rtom)
        : [];
      if (rtom !== 'ALL') {
        scopedRtoms = scopedRtoms.includes(rtom) ? [rtom] : [];
      }
    }

    // ── Resolve OPMC scope for Project-linked queries ──────────────────
    const opmcWhere: Prisma.ProjectWhereInput =
      accessibleOpmcs === undefined
        ? {} // admin — no filter
        : accessibleOpmcs.length > 0
          ? { opmcId: { in: accessibleOpmcs } }
          : { opmcId: NIL_UUID }; // deny all

    // ── Invoice where-clause helpers ───────────────────────────────────
    const invoiceScopeWhere: Prisma.InvoiceWhereInput = {};
    if (scopedRtoms !== undefined) {
      invoiceScopeWhere.rtomArea = { in: scopedRtoms };
    } else if (rtom !== 'ALL') {
      invoiceScopeWhere.rtomArea = rtom;
    }

    // ── Project-link scope helper (returns partial where for each model) ─
    const projScope = (accessibleOpmcs !== undefined ? { project: opmcWhere } : {}) as Record<string, unknown>;

    // ── All 7 queries in parallel ──────────────────────────────────────
    const [
      outstandingInvoicesAgg,
      pendingPVCount,
      totalRetentionSum,
      activePenaltiesSum,
      overdueInvoices,
      topVendorsSpend,
      paidVouchers
    ] = await Promise.all([
      // 1. Outstanding Invoices — computed from amountA + amountB by status
      //    (totalAmount may be stale; split-track amounts are authoritative)
      prisma.invoice.aggregate({
        _sum: {
          amountA: true,
          amountB: true,
        },
        where: {
          ...invoiceScopeWhere,
          OR: [
            { statusA: { not: 'PAID' } },
            { statusB: { not: 'PAID' } },
          ],
          status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] },
        }
      }),

      // 2. Pending Payment Vouchers
      prisma.paymentVoucher.count({
        where: { ...projScope, status: 'PENDING_APPROVAL' } as Prisma.PaymentVoucherWhereInput,
      }),

      // 3. Total Project Retention Held
      prisma.projectRetention.aggregate({
        _sum: { balanceAmount: true },
        where: {
          ...projScope,
          status: { not: 'FULLY_RELEASED' },
        } as Prisma.ProjectRetentionWhereInput,
      }),

      // 4. Active Liquidated Damages / Penalties
      prisma.projectLDPenalty.aggregate({
        _sum: { netAmount: true },
        where: {
          ...projScope,
          status: 'APPROVED',
        } as Prisma.ProjectLDPenaltyWhereInput,
      }),

      // 5. Overdue Contractor Invoices
      prisma.invoice.findMany({
        where: {
          ...invoiceScopeWhere,
          status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] },
          dueDate: { lt: today },
        },
        include: {
          contractor: { select: { name: true } }
        },
        orderBy: { dueDate: 'asc' },
        take: 5
      }),

      // 6. Top 5 Vendors by Spend (Purchase Orders)
      prisma.projectPurchaseOrder.groupBy({
        by: ['vendorName'],
        _sum: { totalAmount: true },
        where: {
          ...projScope,
          status: { in: ['APPROVED', 'FULLY_RECEIVED', 'PARTIALLY_RECEIVED'] },
        } as Prisma.ProjectPurchaseOrderWhereInput,
        orderBy: {
          _sum: { totalAmount: 'desc' }
        },
        take: 5
      }),

      // 7. Monthly Payment Voucher Trend (last 6 months)
      prisma.paymentVoucher.findMany({
        where: {
          ...projScope,
          status: 'PAID',
          paymentDate: {
            gte: (() => { const d = new Date(); d.setMonth(d.getMonth() - 5, 1); d.setHours(0, 0, 0, 0); return d; })()
          }
        } as Prisma.PaymentVoucherWhereInput,
        select: {
          amount: true,
          paymentDate: true
        }
      }),
    ]);

    // ── Compute outstanding from split-track amounts ───────────────────
    const outstandingAmount =
      Number(outstandingInvoicesAgg._sum.amountA || 0) +
      Number(outstandingInvoicesAgg._sum.amountB || 0);

    // ── Group paid vouchers by month-year ──────────────────────────────
    const monthlyTrendMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(today.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyTrendMap.set(key, 0);
    }

    paidVouchers.forEach(pv => {
      if (pv.paymentDate) {
        const key = pv.paymentDate.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyTrendMap.has(key)) {
          monthlyTrendMap.set(key, (monthlyTrendMap.get(key) || 0) + Number(pv.amount));
        }
      }
    });

    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([month, total]) => ({ month, total }))
      .reverse();

    return {
      metrics: {
        outstandingInvoices: outstandingAmount,
        pendingPVs: pendingPVCount,
        totalRetentionHeld: Number(totalRetentionSum._sum.balanceAmount || 0),
        activePenalties: Number(activePenaltiesSum._sum.netAmount || 0)
      },
      overdueInvoices: overdueInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contractorName: inv.contractor.name,
        amount: Number(inv.totalAmount || 0),
        dueDate: inv.dueDate
      })),
      topVendors: topVendorsSpend.map(vendor => ({
        name: vendor.vendorName,
        totalSpend: Number(vendor._sum.totalAmount || 0)
      })),
      monthlyTrend
    };
  }
}
