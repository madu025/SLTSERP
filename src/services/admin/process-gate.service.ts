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
    domainAction?: string | null;
  }) {
    // Normalize empty webhook selection to NULL (column is nullable)
    const payload = { ...data, domainAction: data.domainAction || null };

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
      data: payload,
      include: {
        approvalLevels: true
      }
    });
  }

  /**
   * Update an existing Process Gate Policy
   */
  static async updateGate(id: string, data: Prisma.ProcessGatePolicyUpdateInput) {
    const gate = await prisma.processGatePolicy.findUnique({ where: { id }, select: { id: true } });
    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }

    // Normalize empty webhook selection to NULL
    if ('domainAction' in data && data.domainAction === '') {
      data = { ...data, domainAction: null };
    }

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
    const gate = await prisma.processGatePolicy.findUnique({ where: { id }, select: { id: true } });
    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }

    // Guard: do not orphan in-flight approvals. UniversalApprovalInstance.policyId
    // is onDelete: SetNull, so deleting mid-workflow would leave PENDING instances
    // stranded with no policy chain.
    const pendingCount = await prisma.universalApprovalInstance.count({
      where: { policyId: id, status: 'PENDING' }
    });
    if (pendingCount > 0) {
      throw AppError.badRequest(
        `Cannot delete gate policy: ${pendingCount} approval instance(s) are still PENDING. Resolve or reject them first.`
      );
    }

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
      select: { id: true }
    });

    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }

    // Transactional: compute next level and insert atomically so concurrent
    // POSTs cannot create duplicate level numbers.
    return prisma.$transaction(async (tx) => {
      const maxResult = await tx.processApprovalLevel.findFirst({
        where: { gatePolicyId },
        orderBy: { level: 'desc' },
        select: { level: true }
      });
      const nextLevel = (maxResult?.level ?? 0) + 1;

      return tx.processApprovalLevel.create({
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
    });
  }

  /**
   * Replace ALL approval levels of a gate atomically (wizard save path).
   * Levels are re-numbered 1..N in array order.
   */
  static async replaceApprovalLevels(
    gatePolicyId: string,
    levels: Array<{
      requiredRole: string;
      specificUserId?: string | null;
      description?: string | null;
      minAmount?: number | null;
      maxAmount?: number | null;
    }>
  ) {
    const gate = await prisma.processGatePolicy.findUnique({
      where: { id: gatePolicyId },
      select: { id: true }
    });
    if (!gate) {
      throw AppError.notFound('Process Gate Policy not found');
    }

    return prisma.$transaction(async (tx) => {
      await tx.processApprovalLevel.deleteMany({ where: { gatePolicyId } });
      if (levels.length === 0) return [];

      const created = await tx.processApprovalLevel.createMany({
        data: levels.map((lvl, idx) => ({
          gatePolicyId,
          level: idx + 1,
          requiredRole: lvl.requiredRole,
          specificUserId: lvl.specificUserId ?? null,
          description: lvl.description ?? null,
          minAmount: lvl.minAmount != null ? new Prisma.Decimal(lvl.minAmount) : null,
          maxAmount: lvl.maxAmount != null ? new Prisma.Decimal(lvl.maxAmount) : null
        }))
      });

      return created;
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
          rolesToNotify: ['HEAD_OF_SECTION'],
          approvalLevels: [{ level: 1, requiredRole: 'HEAD_OF_SECTION', description: 'Head of Section authorizes high-value material allocation' }]
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

        // Ensure approval levels exist (idempotent via upsert on gatePolicyId+level)
        for (const lvl of approvalLevels) {
          await tx.processApprovalLevel.upsert({
            where: {
              gatePolicyId_level: {
                gatePolicyId: upserted.id,
                level: lvl.level
              }
            },
            update: {
              requiredRole: lvl.requiredRole,
              description: lvl.description
            },
            create: {
              gatePolicyId: upserted.id,
              level: lvl.level,
              requiredRole: lvl.requiredRole,
              description: lvl.description
            }
          });
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
          await tx.processApprovalLevel.upsert({
            where: {
              gatePolicyId_level: {
                gatePolicyId: upserted.id,
                level: lvl.level
              }
            },
            update: {
              requiredRole: lvl.requiredRole,
              description: lvl.description
            },
            create: {
              gatePolicyId: upserted.id,
              level: lvl.level,
              requiredRole: lvl.requiredRole,
              description: lvl.description
            }
          });
        }
      }

      return true;
    });
  }
}
