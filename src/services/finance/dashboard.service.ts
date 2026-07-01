import { prisma } from '@/lib/prisma';

export class FinanceDashboardService {
  /**
   * Aggregate financial summary metrics for dashboard widgets
   */
  static async getDashboardMetrics() {
    const today = new Date();

    // 1. Outstanding Invoices (Contractor Invoices unpaid)
    const outstandingInvoicesSum = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] } }
    });

    // 2. Pending Payment Vouchers
    const pendingPVCount = await prisma.paymentVoucher.count({
      where: { status: 'PENDING_APPROVAL' }
    });

    // 3. Total Project Retention Held
    const totalRetentionSum = await prisma.projectRetention.aggregate({
      _sum: { balanceAmount: true },
      where: { status: { not: 'FULLY_RELEASED' } }
    });

    // 4. Active Liquidated Damages / Penalties (Approved but not yet collected)
    const activePenaltiesSum = await prisma.projectLDPenalty.aggregate({
      _sum: { netAmount: true },
      where: { status: 'APPROVED' }
    });

    // 5. Overdue Contractor Invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] },
        dueDate: { lt: today }
      },
      include: {
        contractor: { select: { name: true } }
      },
      orderBy: { dueDate: 'asc' },
      take: 5
    });

    // 6. Top 5 Vendors by Spend (Purchase Orders approved/received)
    const topVendorsSpend = await prisma.projectPurchaseOrder.groupBy({
      by: ['vendorName'],
      _sum: { totalAmount: true },
      where: {
        status: { in: ['APPROVED', 'FULLY_RECEIVED', 'PARTIALLY_RECEIVED'] }
      },
      orderBy: {
        _sum: { totalAmount: 'desc' }
      },
      take: 5
    });

    // 7. Monthly Payment Voucher Trend (Paid Vouchers by month for last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const paidVouchers = await prisma.paymentVoucher.findMany({
      where: {
        status: 'PAID',
        paymentDate: { gte: sixMonthsAgo }
      },
      select: {
        amount: true,
        paymentDate: true
      }
    });

    // Group paid vouchers by month-year
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
          monthlyTrendMap.set(key, (monthlyTrendMap.get(key) || 0) + pv.amount);
        }
      }
    });

    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([month, total]) => ({ month, total }))
      .reverse();

    return {
      metrics: {
        outstandingInvoices: outstandingInvoicesSum._sum.totalAmount || 0,
        pendingPVs: pendingPVCount,
        totalRetentionHeld: totalRetentionSum._sum.balanceAmount || 0,
        activePenalties: activePenaltiesSum._sum.netAmount || 0
      },
      overdueInvoices: overdueInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contractorName: inv.contractor.name,
        amount: inv.totalAmount,
        dueDate: inv.dueDate
      })),
      topVendors: topVendorsSpend.map(vendor => ({
        name: vendor.vendorName,
        totalSpend: vendor._sum.totalAmount || 0
      })),
      monthlyTrend
    };
  }
}
