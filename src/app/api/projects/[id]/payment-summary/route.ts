import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/payment-summary - 3-level payment breakdown
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [invoices, payments, retentions, project, expenses, boqTotal] = await Promise.all([
      prisma.projectInvoice.findMany({
        where: { projectId },
        select: {
          id: true,
          invoiceNumber: true,
          title: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          type: true,
          invoiceDate: true,
          payments: {
            select: {
              pvNumber: true,
              amount: true,
              status: true,
              paymentDate: true,
              paymentMethod: true,
            },
            orderBy: { paymentDate: 'desc' },
          },
        },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.paymentVoucher.aggregate({
        where: { projectId },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.projectRetention.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          retentionPercent: true,
          retentionAmount: true,
          releaseCondition: true,
          defectLiabilityPeriod: true,
          releases: {
            select: { releaseAmount: true, releaseDate: true },
            orderBy: { releaseDate: 'desc' },
          },
        },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { budget: true, actualCost: true, name: true },
      }),
      prisma.projectExpense.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
      prisma.projectBOQItem.aggregate({
        where: { projectId },
        _sum: { amount: true },
      }),
    ]);

    // 3-Level payment analysis
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalBalance = invoices.reduce((s, i) => s + i.balanceAmount, 0);
    const totalRetained = retentions
      .filter((r) => r.status === 'HELD')
      .reduce((s, r) => s + r.retentionAmount, 0);
    const totalReleased = retentions
      .filter((r) => r.status === 'RELEASED')
      .reduce((s, r) => s + r.retentionAmount, 0);

    const boqEstimate = boqTotal._sum.amount ?? 0;
    const budget = project?.budget ?? 0;
    const actualCost = project?.actualCost ?? 0;

    return NextResponse.json({
      project: {
        id: projectId,
        name: project?.name,
        budget,
        boqEstimate,
        actualCost,
        costVariance: budget - actualCost,
      },
      paymentSummary: {
        totalInvoiced,
        totalPaid,
        totalBalance,
        paymentProgress: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0,
        paymentCount: payments._count.id,
        totalPaymentAmount: payments._sum.amount ?? 0,
        expenses: expenses._sum.amount ?? 0,
        totalRetained,
        totalReleasedRetentions: totalReleased,
      },
      invoices: invoices.map((inv) => ({
        ...inv,
        paymentBreakdown: [
          { level: 1, label: 'Advance Payment (30%)', amount: inv.totalAmount * 0.3 },
          { level: 2, label: 'Work Completion (50%)', amount: inv.totalAmount * 0.5 },
          { level: 3, label: 'Final + Retention Release (20%)', amount: inv.totalAmount * 0.2 },
        ],
      })),
      retentions,
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    return NextResponse.json({ error: 'Failed to fetch payment summary' }, { status: 500 });
  }
}