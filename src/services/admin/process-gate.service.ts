import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';

export class ProcessGateAdminService {
  /**
   * Get all Process Gate Policies
   */
  static async getAllGates() {
    return prisma.processGatePolicy.findMany({
      include: {
        approvalLevels: {
          orderBy: { level: 'asc' }
        }
      },
      orderBy: [
        { entityType: 'asc' },
        { fromStatus: 'asc' }
      ]
    });
  }

  /**
   * Get a single Gate Policy by ID
   */
  static async getGateById(id: string) {
    const gate = await prisma.processGatePolicy.findUnique({
      where: { id },
      include: {
        approvalLevels: {
          orderBy: { level: 'asc' }
        }
      }
    });

    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }
    return gate;
  }

  /**
   * Create a new Process Gate Policy
   */
  static async createGate(data: {
    entityType: string;
    fromStatus: string;
    toStatus: string;
    label: string;
    isEnabled?: boolean;
    reqOpmcPat?: boolean;
    reqHoPat?: boolean;
    reqSltsPat?: boolean;
    reqPhotoProof?: boolean;
    reqGpsLocation?: boolean;
    reqDocUpload?: boolean;
    writeAuditLedger?: boolean;
    generateIssueNote?: boolean;
  }) {
    // Check if unique constraint would be violated
    const existing = await prisma.processGatePolicy.findUnique({
      where: {
        entityType_fromStatus_toStatus: {
          entityType: data.entityType,
          fromStatus: data.fromStatus,
          toStatus: data.toStatus
        }
      }
    });

    if (existing) {
      throw AppError.badRequest(`A gate policy already exists for ${data.entityType} transitioning from ${data.fromStatus} to ${data.toStatus}`);
    }

    return prisma.processGatePolicy.create({
      data,
      include: {
        approvalLevels: true
      }
    });
  }

  /**
   * Update an existing Process Gate Policy
   */
  static async updateGate(id: string, data: Prisma.ProcessGatePolicyUpdateInput) {
    return prisma.processGatePolicy.update({
      where: { id },
      data,
      include: {
        approvalLevels: {
          orderBy: { level: 'asc' }
        }
      }
    });
  }

  /**
   * Delete a Process Gate Policy
   */
  static async deleteGate(id: string) {
    return prisma.processGatePolicy.delete({
      where: { id }
    });
  }

  /**
   * Add a new Approval Level to a Gate Policy
   */
  static async addApprovalLevel(gatePolicyId: string, data: {
    requiredRole: string;
    specificUserId?: string;
    description?: string;
    minAmount?: number;
    maxAmount?: number;
  }) {
    const gate = await prisma.processGatePolicy.findUnique({
      where: { id: gatePolicyId },
      include: { approvalLevels: true }
    });

    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }

    // Determine the next level number
    const maxLevel = gate.approvalLevels.reduce((max, level) => Math.max(max, level.level), 0);
    const nextLevel = maxLevel + 1;

    return prisma.processApprovalLevel.create({
      data: {
        gatePolicyId,
        level: nextLevel,
        requiredRole: data.requiredRole,
        specificUserId: data.specificUserId,
        description: data.description,
        minAmount: data.minAmount !== undefined ? new Prisma.Decimal(data.minAmount) : null,
        maxAmount: data.maxAmount !== undefined ? new Prisma.Decimal(data.maxAmount) : null,
      }
    });
  }

  /**
   * Delete an Approval Level and re-order the remaining levels
   */
  static async deleteApprovalLevel(gatePolicyId: string, levelId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete the specified level
      await tx.processApprovalLevel.delete({
        where: { id: levelId, gatePolicyId }
      });

      // 2. Fetch remaining levels and order them by current level
      const remainingLevels = await tx.processApprovalLevel.findMany({
        where: { gatePolicyId },
        orderBy: { level: 'asc' }
      });

      // 3. Re-assign levels sequentially (1, 2, 3...)
      for (let i = 0; i < remainingLevels.length; i++) {
        const correctLevel = i + 1;
        if (remainingLevels[i].level !== correctLevel) {
          await tx.processApprovalLevel.update({
            where: { id: remainingLevels[i].id },
            data: { level: correctLevel }
          });
        }
      }

      return true;
    });
  }
}
