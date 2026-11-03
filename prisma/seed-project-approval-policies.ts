import type { PrismaClient } from '@prisma/client';

type PolicyLevelSeed = {
  level: number;
  requiredRole: string;
  policyVariant: string;
  eligibleRoles: string[];
  description: string;
};

const BOQ_LEVELS: PolicyLevelSeed[] = [
  {
    level: 1,
    requiredRole: 'BOQ_SUPERVISOR',
    policyVariant: 'DEFAULT',
    eligibleRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'QC_OFFICER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR'],
    description: 'Technical/project BOQ supervisor step',
  },
  {
    level: 2,
    requiredRole: 'BOQ_PROJECT_MANAGER',
    policyVariant: 'DEFAULT',
    eligibleRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    description: 'Project manager BOQ step',
  },
  {
    level: 3,
    requiredRole: 'BOQ_FINANCE',
    policyVariant: 'DEFAULT',
    eligibleRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'STORES_MANAGER'],
    description: 'Finance BOQ step',
  },
];

const CHANGE_REQUEST_LEVELS: PolicyLevelSeed[] = [
  ...['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'].map((requiredRole, index) => ({
    level: index + 1,
    requiredRole,
    policyVariant: 'UNDER_100K',
    eligibleRoles: [requiredRole],
    description: 'Section-manager chain (legacy default)',
  })),
  ...['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER'].flatMap((requiredRole, index) => [
    {
      level: index + 1,
      requiredRole,
      policyVariant: 'FROM_100K_TO_500K',
      eligibleRoles: [requiredRole],
      description: 'Project-manager chain (legacy default)',
    },
    {
      level: index + 1,
      requiredRole,
      policyVariant: 'OVER_500K',
      eligibleRoles: [requiredRole],
      description: 'Project-manager chain (legacy default)',
    },
  ]),
];

async function ensurePolicy(
  prisma: PrismaClient,
  input: { entityType: string; fromStatus: string; toStatus: string; label: string; levels: PolicyLevelSeed[] },
) {
  const existing = await prisma.processGatePolicy.findUnique({
    where: {
      entityType_fromStatus_toStatus: {
        entityType: input.entityType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
      },
    },
  });

  // Never overwrite an administrator-configured policy. A deployment may seed
  // only a missing policy; incomplete existing configuration fails closed and
  // is surfaced for explicit admin repair.
  const policy = existing ?? await prisma.processGatePolicy.create({
    data: {
      entityType: input.entityType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      label: input.label,
      isEnabled: true,
      approvalStrategy: 'ALL_MUST_APPROVE',
    },
  });

  const variants = [...new Set(input.levels.map((level) => level.policyVariant))];
  for (const policyVariant of variants) {
    const levels = input.levels.filter((level) => level.policyVariant === policyVariant);
    const existingCount = await prisma.processApprovalLevel.count({ where: { gatePolicyId: policy.id, policyVariant } });
    if (existingCount === 0) {
      await prisma.processApprovalLevel.createMany({
        data: levels.map((level) => ({
          gatePolicyId: policy.id,
          level: level.level,
          requiredRole: level.requiredRole,
          policyVariant,
          requiredPermission: 'project.approve',
          eligibleRoles: level.eligibleRoles,
          description: level.description,
        })),
      });
    } else {
      const configuredLevels = await prisma.processApprovalLevel.findMany({
        where: { gatePolicyId: policy.id, policyVariant },
        select: { requiredPermission: true, eligibleRoles: true },
      });
      const incompleteCount = configuredLevels.filter((level) => (
        !level.requiredPermission || !Array.isArray(level.eligibleRoles)
      )).length;
      if (existingCount !== levels.length || incompleteCount > 0) {
        throw new Error(`Project approval policy ${input.entityType}/${policyVariant} is incomplete; refusing to overwrite administrator configuration.`);
      }
    }
  }
}

export async function seedProjectApprovalPolicies(prisma: PrismaClient) {
  await ensurePolicy(prisma, {
    entityType: 'PROJECT_BOQ_APPROVAL',
    fromStatus: 'PENDING',
    toStatus: 'APPROVED',
    label: 'Project BOQ approval (DB-backed role policy)',
    levels: BOQ_LEVELS,
  });
  await ensurePolicy(prisma, {
    entityType: 'PROJECT_CHANGE_REQUEST',
    fromStatus: 'DRAFT',
    toStatus: 'SUBMITTED',
    label: 'Project change-request approval (DB-backed amount policy)',
    levels: CHANGE_REQUEST_LEVELS,
  });
}
