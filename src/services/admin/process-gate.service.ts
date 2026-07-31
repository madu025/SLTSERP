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

  /**
   * Seed / Load Industrial Standard Workflow Templates
   */
  static async seedIndustrialTemplates() {
    return prisma.$transaction(async (tx) => {
      // 1. MATERIAL_REQUEST 4-Step End-to-End Workflow
      const mrGates = [
        {
          entityType: 'MATERIAL_REQUEST',
          fromStatus: 'DRAFT',
          toStatus: 'OSP_MANAGER_APPROVAL',
          label: '1. MRN Submission & OSP Review',
          isEnabled: true,
          rolesToNotify: ['OSP_MANAGER'],
          approvalLevels: [{ level: 1, requiredRole: 'OSP_MANAGER', description: 'OSP Manager verifies field requirements' }]
        },
        {
          entityType: 'MATERIAL_REQUEST',
          fromStatus: 'OSP_MANAGER_APPROVAL',
          toStatus: 'HOS_APPROVAL',
          label: '2. Head of Section Signoff',
          isEnabled: true,
          rolesToNotify: ['HOS'],
          approvalLevels: [{ level: 1, requiredRole: 'HOS', description: 'HOS authorizes high-value material allocation' }]
        },
        {
          entityType: 'MATERIAL_REQUEST',
          fromStatus: 'HOS_APPROVAL',
          toStatus: 'PROCUREMENT',
          label: '3. Procurement Authorization',
          isEnabled: true,
          rolesToNotify: ['PROCUREMENT_OFFICER'],
          approvalLevels: [{ level: 1, requiredRole: 'PROCUREMENT_OFFICER', description: 'Procurement checks store stock & supplier PO' }]
        },
        {
          entityType: 'MATERIAL_REQUEST',
          fromStatus: 'PROCUREMENT',
          toStatus: 'ISSUED',
          label: '4. Main Store Material Dispatch (MIN)',
          isEnabled: true,
          generateIssueNote: true,
          writeAuditLedger: true,
          rolesToNotify: ['STORES_MANAGER'],
          approvalLevels: [{ level: 1, requiredRole: 'STORES_MANAGER', description: 'Main Store issues MIN note and releases inventory' }]
        }
      ];

      for (const g of mrGates) {
        const { approvalLevels, ...gateData } = g;
        const upserted = await tx.processGatePolicy.upsert({
          where: {
            entityType_fromStatus_toStatus: {
              entityType: gateData.entityType,
              fromStatus: gateData.fromStatus,
              toStatus: gateData.toStatus
            }
          },
          update: gateData,
          create: gateData
        });

        // Ensure approval levels exist
        for (const lvl of approvalLevels) {
          const existingLvl = await tx.processApprovalLevel.findFirst({
            where: { gatePolicyId: upserted.id, level: lvl.level }
          });

          if (!existingLvl) {
            await tx.processApprovalLevel.create({
              data: {
                gatePolicyId: upserted.id,
                level: lvl.level,
                requiredRole: lvl.requiredRole,
                description: lvl.description
              }
            });
          }
        }
      }

      // 2. SERVICE_ORDER 3-Step Workflow
      const sodGates = [
        {
          entityType: 'SERVICE_ORDER',
          fromStatus: 'PENDING',
          toStatus: 'ASSIGNED',
          label: '1. Contractor Work Assignment',
          isEnabled: true,
          approvalLevels: [{ level: 1, requiredRole: 'ENGINEER', description: 'Engineer assigns contractor team' }]
        },
        {
          entityType: 'SERVICE_ORDER',
          fromStatus: 'ASSIGNED',
          toStatus: 'INPROGRESS',
          label: '2. Field Survey & Civil Execution',
          isEnabled: true,
          reqGpsLocation: true,
          reqPhotoProof: true,
          approvalLevels: [{ level: 1, requiredRole: 'CONTRACTOR', description: 'Contractor starts execution with GPS & photos' }]
        },
        {
          entityType: 'SERVICE_ORDER',
          fromStatus: 'INPROGRESS',
          toStatus: 'COMPLETED',
          label: '3. Provisional Acceptance Testing (PAT)',
          isEnabled: true,
          reqSltsPat: true,
          writeAuditLedger: true,
          approvalLevels: [
            { level: 1, requiredRole: 'ENGINEER', description: 'Engineer verifies PAT document' },
            { level: 2, requiredRole: 'OSP_MANAGER', description: 'OSP Manager final signoff' }
          ]
        }
      ];

      for (const g of sodGates) {
        const { approvalLevels, ...gateData } = g;
        const upserted = await tx.processGatePolicy.upsert({
          where: {
            entityType_fromStatus_toStatus: {
              entityType: gateData.entityType,
              fromStatus: gateData.fromStatus,
              toStatus: gateData.toStatus
            }
          },
          update: gateData,
          create: gateData
        });

        for (const lvl of approvalLevels) {
          const existingLvl = await tx.processApprovalLevel.findFirst({
            where: { gatePolicyId: upserted.id, level: lvl.level }
          });

          if (!existingLvl) {
            await tx.processApprovalLevel.create({
              data: {
                gatePolicyId: upserted.id,
                level: lvl.level,
                requiredRole: lvl.requiredRole,
                description: lvl.description
              }
            });
          }
        }
      }

      return true;
    });
  }
}
