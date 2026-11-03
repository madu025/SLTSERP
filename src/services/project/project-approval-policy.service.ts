import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export const PROJECT_BOQ_APPROVAL_POLICY = {
  entityType: 'PROJECT_BOQ_APPROVAL',
  fromStatus: 'PENDING',
  toStatus: 'APPROVED',
  variant: 'DEFAULT',
} as const;

export const PROJECT_CHANGE_REQUEST_POLICY = {
  entityType: 'PROJECT_CHANGE_REQUEST',
  fromStatus: 'DRAFT',
  toStatus: 'SUBMITTED',
} as const;

export const BOQ_APPROVAL_STEP = {
  SUPERVISOR: 'BOQ_SUPERVISOR',
  PROJECT_MANAGER: 'BOQ_PROJECT_MANAGER',
  FINANCE: 'BOQ_FINANCE',
} as const;

export type ChangeRequestPolicyVariant =
  | 'UNDER_100K'
  | 'FROM_100K_TO_500K'
  | 'OVER_500K';

type ApprovalLevel = {
  id: string;
  level: number;
  requiredRole: string;
  policyVariant: string;
  requiredPermission: string | null;
  eligibleRoles: unknown;
};

type ApprovalPolicy = {
  id: string;
  entityType: string;
  fromStatus: string;
  toStatus: string;
  approvalLevels: ApprovalLevel[];
};

function policyFailure(entityType: string, variant: string): never {
  throw AppError.serviceUnavailable(
    `Workflow approval policy is missing or incomplete for ${entityType}/${variant}; approval is fail-closed until the DB seed is applied.`,
  );
}

async function loadPolicy(entityType: string, fromStatus: string, toStatus: string, variant: string): Promise<ApprovalPolicy> {
  const policy = await prisma.processGatePolicy.findFirst({
    where: { entityType, fromStatus, toStatus, isEnabled: true },
    include: {
      approvalLevels: {
        where: { policyVariant: variant },
        orderBy: { level: 'asc' },
      },
    },
  });

  if (!policy || policy.approvalLevels.length === 0) {
    return policyFailure(entityType, variant);
  }

  const levels = policy.approvalLevels as ApprovalLevel[];
  if (levels.some((level) => level.requiredPermission !== RBAC_PERMISSIONS.PROJECT_APPROVE)) {
    return policyFailure(entityType, variant);
  }

  return { ...policy, approvalLevels: levels };
}

export async function getBoqApprovalPolicy(): Promise<ApprovalPolicy> {
  return loadPolicy(
    PROJECT_BOQ_APPROVAL_POLICY.entityType,
    PROJECT_BOQ_APPROVAL_POLICY.fromStatus,
    PROJECT_BOQ_APPROVAL_POLICY.toStatus,
    PROJECT_BOQ_APPROVAL_POLICY.variant,
  );
}

export async function getBoqApprovalLevel(step: string): Promise<{ policy: ApprovalPolicy; level: ApprovalLevel }> {
  const policy = await getBoqApprovalPolicy();
  const requiredRole = step === 'SUPERVISOR'
    ? BOQ_APPROVAL_STEP.SUPERVISOR
    : step === 'PROJECT_MANAGER'
      ? BOQ_APPROVAL_STEP.PROJECT_MANAGER
      : step === 'FINANCE'
        ? BOQ_APPROVAL_STEP.FINANCE
        : null;
  const level = requiredRole ? policy.approvalLevels.find((candidate) => candidate.requiredRole === requiredRole) : undefined;
  if (!level) return policyFailure(policy.entityType, step);
  return { policy, level };
}

export async function getChangeRequestApprovalPolicy(variant: ChangeRequestPolicyVariant): Promise<ApprovalPolicy> {
  return loadPolicy(
    PROJECT_CHANGE_REQUEST_POLICY.entityType,
    PROJECT_CHANGE_REQUEST_POLICY.fromStatus,
    PROJECT_CHANGE_REQUEST_POLICY.toStatus,
    variant,
  );
}

export function getChangeRequestPolicyVariant(costImpact: number): ChangeRequestPolicyVariant {
  if (costImpact < 100_000) return 'UNDER_100K';
  if (costImpact < 500_000) return 'FROM_100K_TO_500K';
  return 'OVER_500K';
}

export function parseEligibleRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is string => typeof role === 'string').map((role) => role.replace(/_GLOBAL$/, ''));
}

export function hasEligiblePolicyRole(roles: ReadonlyArray<{ code: string; isActive: boolean } | null | undefined>, eligibleRoles: unknown): boolean {
  const allowed = new Set(parseEligibleRoles(eligibleRoles));
  return roles.some((role) => role?.isActive && allowed.has(role.code.replace(/_GLOBAL$/, '')));
}
