import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class RetentionService {
  /**
   * Get all project retentions with optional status and project filters
   */
  static async getRetentions(filters?: { status?: string; projectId?: string }) {
    const where: Prisma.ProjectRetentionWhereInput = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    return prisma.projectRetention.findMany({
      where,
      include: {
        project: {
          select: { name: true, projectCode: true, budget: true }
        },
        invoice: {
          select: { invoiceNumber: true, totalAmount: true }
        },
        releases: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Release an amount from a project's retention balance
   */
  static async releaseRetention(data: {
    retentionId: string;
    releaseAmount: number;
    approvedById?: string;
    remarks?: string;
  }) {
    const retention = await prisma.projectRetention.findUnique({
      where: { id: data.retentionId }
    });

    if (!retention) throw AppError.badRequest('RETENTION_RECORD_NOT_FOUND');

    const newReleasedAmount = retention.releasedAmount + data.releaseAmount;
    const balanceAmount = retention.retentionAmount - newReleasedAmount;

    if (balanceAmount < 0) {
      throw AppError.badRequest('RELEASE_AMOUNT_EXCEEDS_BALANCE');
    }

    const status = balanceAmount === 0 ? 'FULLY_RELEASED' : 'PARTIALLY_RELEASED';

    return prisma.$transaction(async (tx) => {
      // 1. Create the Release record
      const release = await tx.retentionRelease.create({
        data: {
          retentionId: data.retentionId,
          releaseAmount: data.releaseAmount,
          approvedById: data.approvedById || 'system',
          approvedAt: new Date(),
          remarks: data.remarks || null
        }
      });

      // 2. Update retention balance and status
      await tx.projectRetention.update({
        where: { id: data.retentionId },
        data: {
          releasedAmount: newReleasedAmount,
          balanceAmount,
          status
        }
      });

      return release;
    });
  }

  /**
   * Auto-generate or update retention record for a project invoice
   */
  static async createRetentionForInvoice(data: {
    projectId: string;
    invoiceId: string;
    title: string;
    retentionPercent?: number;
    retentionAmount: number;
  }) {
    const retentionPercent = data.retentionPercent || 10;
    
    return prisma.projectRetention.create({
      data: {
        projectId: data.projectId,
        invoiceId: data.invoiceId,
        title: data.title,
        retentionPercent,
        retentionAmount: data.retentionAmount,
        releasedAmount: 0,
        balanceAmount: data.retentionAmount,
        status: 'HELD'
      }
    });
  }
}
