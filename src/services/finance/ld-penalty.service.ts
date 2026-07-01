import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ProposePenaltyInput {
  projectId: string;
  title: string;
  description?: string | null;
  type?: string;
  category?: string;
  amount: number;
  percentage?: number | null;
  referenceTable?: string | null;
  referenceId?: string | null;
  referenceDesc?: string | null;
  remarks?: string | null;
  leviedById?: string | null;
}

export class LDPenaltyService {
  /**
   * Get all penalties with optional status and project filters
   */
  static async getPenalties(filters?: { status?: string; projectId?: string }) {
    const where: Prisma.ProjectLDPenaltyWhereInput = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    return prisma.projectLDPenalty.findMany({
      where,
      include: {
        project: {
          select: { name: true, projectCode: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Propose a new LD / Penalty for a project
   */
  static async proposePenalty(data: ProposePenaltyInput) {
    return prisma.projectLDPenalty.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        type: data.type || 'LD',
        category: data.category || 'DELAY',
        amount: data.amount,
        percentage: data.percentage || null,
        referenceTable: data.referenceTable || null,
        referenceId: data.referenceId || null,
        referenceDesc: data.referenceDesc || null,
        waivedAmount: 0,
        netAmount: data.amount,
        status: 'PROPOSED',
        leviedById: data.leviedById || 'system',
        remarks: data.remarks || null
      }
    });
  }

  /**
   * Approve, Waive, or Collect a Penalty
   */
  static async updatePenaltyStatus(
    id: string,
    status: string,
    userId: string,
    options?: {
      waivedAmount?: number;
      remarks?: string;
    }
  ) {
    const validStatuses = ['APPROVED', 'WAIVED', 'COLLECTED'];
    if (!validStatuses.includes(status)) {
      throw new Error('INVALID_STATUS');
    }

    const penalty = await prisma.projectLDPenalty.findUnique({ where: { id } });
    if (!penalty) throw new Error('PENALTY_NOT_FOUND');

    const updateData: Prisma.ProjectLDPenaltyUpdateInput = { status };

    if (status === 'APPROVED') {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
      updateData.appliedDate = new Date();
    } else if (status === 'WAIVED') {
      const waived = options?.waivedAmount !== undefined ? options.waivedAmount : penalty.amount;
      updateData.waivedAmount = waived;
      updateData.netAmount = Math.max(0, penalty.amount - waived);
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    if (options?.remarks) {
      updateData.remarks = options.remarks;
    }

    return prisma.projectLDPenalty.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete a proposed penalty (only if status is PROPOSED)
   */
  static async deletePenalty(id: string) {
    const penalty = await prisma.projectLDPenalty.findUnique({ where: { id } });
    if (!penalty) throw new Error('PENALTY_NOT_FOUND');
    if (penalty.status !== 'PROPOSED') {
      throw new Error('ONLY_PROPOSED_PENALTIES_CAN_BE_DELETED');
    }

    return prisma.projectLDPenalty.delete({ where: { id } });
  }
}
