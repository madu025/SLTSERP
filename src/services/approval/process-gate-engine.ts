import { defaultGateDomainAction } from './gate-default-action';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { requireEnv } from '@/lib/env';
import { DynamicApprovalService } from './dynamic-approval.service';
import { DomainActionDispatcher } from './domain-dispatcher.service';
import { Prisma } from '@prisma/client';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { isCanonicalPermission, RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import crypto from 'crypto';
import { firstApplicableLevel, hasEligibleRole, mayActOnLevel, parseEligibleRoles, type GateScope } from '@/lib/gate-eligibility';

export interface CreateUniversalApprovalInstancePayload {
    entityId: string;
    entityType: string;
    policyId?: string;
    levelIndex?: number;
    level: number;
    requiredRole: string;
    requiredPermission?: string;
    eligibleRoles?: string[];
    policyVariant?: string;
    assignedUserId?: string | null;
    makerId?: string; // New field for generic SoD checks
    status?: string;
}

export interface UpdateUniversalApprovalInstancePayload {
    status?: string;
    actionedBy?: { connect: { id: string } };
    actionedById?: string;
    actionedAt?: Date;
    comments?: string;
    payload?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    signatureHash?: string;
}

type ApprovalPolicyLevel = {
    level: number;
    requiredRole: string;
    requiredPermission: string | null;
    eligibleRoles: Prisma.JsonValue | null;
    specificUserId: string | null;
    description?: string | null;
    /** ROLE (default) or ORDER_CONTRACTOR: the contractor the service order is assigned to */
    assignee?: string | null;
    skipIfNoApprover?: boolean | null;
};

function assertCanonicalLevel(level: ApprovalPolicyLevel, context: string) {
    if (!level.requiredPermission || !isCanonicalPermission(level.requiredPermission)) {
        throw AppError.badRequest(`Workflow policy is incomplete: ${context} requires a valid canonical approval permission.`);
    }
    const eligibleRoles = parseEligibleRoles(level.eligibleRoles);
    if (!level.specificUserId && eligibleRoles.length === 0 && level.assignee !== 'ORDER_CONTRACTOR') {
        throw AppError.badRequest(`Workflow policy is incomplete: ${context} requires canonical eligible role assignments.`);
    }
    return { requiredPermission: level.requiredPermission, eligibleRoles };
}

const hasEligibleCanonicalRole = hasEligibleRole;

/**
 * In-app approvals (no approval-instance row) must honour the same eligibility the gate policy defines:
 * the actor needs an eligible role for the stage, unless they administer RBAC or the level names them.
 * Levels without canonical role data are left to the existing permission check.
 */
export async function assertActorEligibleForGateLevel(
    client: Prisma.TransactionClient,
    userId: string,
    level: ApprovalPolicyLevel | undefined,
    stage: string,
) {
    if (!level) return;
    const eligibleRoles = parseEligibleRoles(level.eligibleRoles);
    if (eligibleRoles.length === 0 && !level.specificUserId) return;
    const user = await client.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            status: true,
            permissions: true,
            systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } },
            sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } } } },
        },
    });
    if (!user || user.status !== 'active') {
        throw AppError.unauthorized('Authenticated approval actor is not active.');
    }
    const isAdmin = deriveEffectivePermissions(user).includes(RBAC_PERMISSIONS.ADMIN_RBAC);
    if (isAdmin || level.specificUserId === userId) return;
    if (!hasEligibleCanonicalRole(user, eligibleRoles)) {
        throw AppError.forbidden(`APPROVER_ROLE_NOT_ELIGIBLE: stage ${stage} can only be actioned by ${eligibleRoles.join(', ')}.`);
    }
}

/** The area and contractor a gate entity belongs to (only service orders carry them). Used by queue gates. */
export async function loadGateScope(client: Prisma.TransactionClient, entityType: string, entityId: string): Promise<GateScope> {
    if (entityType === 'INVOICE') {
        try {
            const invoice = await client.invoice.findUnique({ where: { id: entityId }, select: { contractorId: true, contractor: { select: { opmcId: true } } } });
            return { opmcId: invoice?.contractor?.opmcId ?? null, contractorId: invoice?.contractorId ?? null };
        } catch {
            return {};
        }
    }
    if (entityType !== 'SERVICE_ORDER') return {};
    try {
        const order = await client.serviceOrder.findUnique({ where: { id: entityId }, select: { opmcId: true, contractorId: true } });
        return { opmcId: order?.opmcId ?? null, contractorId: order?.contractorId ?? null };
    } catch {
        return {};
    }
}

async function findCanonicalApprover(
    client: Prisma.TransactionClient,
    level: ApprovalPolicyLevel,
    scope?: GateScope,
) {
    const { requiredPermission, eligibleRoles } = assertCanonicalLevel(level, `level ${level.level}`);
    const users = await client.user.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            email: true,
            isOOO: true,
            delegatedUserId: true,
            contractorId: true,
            accessibleOpmcs: { select: { id: true } },
            permissions: true,
            systemRole: {
                select: {
                    code: true,
                    isActive: true,
                    permissions: true,
                    rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } },
                },
            },
            sectionAssignments: {
                select: {
                    role: {
                        select: {
                            code: true,
                            isActive: true,
                            permissions: true,
                            rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } },
                        },
                    },
                },
            },
        },
    });

    const candidates = users.filter((user) => {
        if (level.specificUserId && user.id !== level.specificUserId) return false;
        const permissions = deriveEffectivePermissions(user);
        if (!permissions.includes(requiredPermission)) return false;
        if (level.assignee === 'ORDER_CONTRACTOR') return !!scope?.contractorId && user.contractorId === scope.contractorId;
        if (scope?.opmcId && !permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC) && !user.accessibleOpmcs.some((o) => o.id === scope.opmcId)) return false;
        return true;
    });
    if (level.assignee === 'ORDER_CONTRACTOR') return candidates[0] ?? null;
    // The person who holds the eligible role gets the approval. An RBAC admin can always act, but is only the
    // assignee when nobody with the role exists: taking the first match in table order used to hand approvals that
    // a role holder could have actioned to an admin account instead.
    return candidates.find((user) => hasEligibleCanonicalRole(user, eligibleRoles))
        ?? candidates.find((user) => deriveEffectivePermissions(user).includes(RBAC_PERMISSIONS.ADMIN_RBAC))
        ?? null;
}

/** Somebody who holds the step's role (not just an administrator) exists in the entity's area. */
async function levelHolderExists(client: Prisma.TransactionClient, level: ApprovalPolicyLevel, scope?: GateScope): Promise<boolean> {
    const { requiredPermission, eligibleRoles } = assertCanonicalLevel(level, `level ${level.level}`);
    const users = await client.user.findMany({
        where: { status: 'active', ...(level.assignee === 'ORDER_CONTRACTOR' && scope?.contractorId ? { contractorId: scope.contractorId } : {}) },
        select: {
            id: true, contractorId: true, permissions: true, accessibleOpmcs: { select: { id: true } },
            systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } },
            sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true, isActive: true } } } } } } } },
        },
    });
    return users.some((user) => {
        const permissions = deriveEffectivePermissions(user);
        if (!permissions.includes(requiredPermission) || permissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) return false;
        if (level.assignee === 'ORDER_CONTRACTOR') return !!scope?.contractorId && user.contractorId === scope.contractorId;
        if (scope?.opmcId && !user.accessibleOpmcs.some((o) => o.id === scope.opmcId)) return false;
        return hasEligibleCanonicalRole(user, eligibleRoles);
    });
}

function resolveApplicableLevel(client: Prisma.TransactionClient, levels: ApprovalPolicyLevel[], from: number, scope?: GateScope) {
    return firstApplicableLevel(levels, from, (level) => levelHolderExists(client, level, scope));
}

/**
 * Tells the approver an approval is waiting. Material requests have their own email; every other entity (service orders,
 * invoices) uses the generic approval email. The material-request email was used for all of them, failed with "Stock
 * Request not found" for anything else, and the error was swallowed, so approvers of service order gates were never told.
 */
async function notifyApprover(params: { instanceId: string; entityType: string; entityId: string; approverEmail: string; approverId: string; requiredRole: string }) {
    const { instanceId, entityType, entityId, approverEmail, approverId, requiredRole } = params;
    if (entityType === 'MATERIAL_REQUEST') {
        await DynamicApprovalService.sendMaterialRequestEmail(instanceId, entityId, approverEmail, approverId, requiredRole);
    } else {
        await DynamicApprovalService.sendActionableEmail(instanceId, entityType, entityId, approverEmail, approverId);
    }
}

export class ProcessGateEngine {
    /**
     * Resolves the matching ProcessGatePolicy for an entity and current status using the RuleEngine.
     *
     * `toStatus` is optional on purpose. A workflow that knows where it is going (the SOD status
     * writer) must say so: policies are keyed uniquely by (entityType, fromStatus, toStatus), so
     * matching on fromStatus alone makes an ASSIGNED -> COMPLETED write inherit the
     * ASSIGNED -> INPROGRESS photo rule and throw. Callers that only advance a stage cursor
     * (stock requests) omit it and keep the historical fromStatus-only semantics.
     */
    static async findMatchingPolicy(params: {
        entityType: string;
        fromStatus: string;
        toStatus?: string;
        entityPayload?: Record<string, unknown>;
    }) {
        const { entityType, fromStatus, toStatus, entityPayload = {} } = params;

        const policies = await prisma.processGatePolicy.findMany({
            where: {
                entityType,
                fromStatus,
                ...(toStatus ? { toStatus } : {}),
                isEnabled: true
            },
            include: {
                approvalLevels: {
                    orderBy: { level: 'asc' }
                }
            }
        });

        const { RuleEngine } = await import('./rule-engine');

        return policies.find(p => {
            const conditions = p.conditions as import('./rule-engine').RuleCondition | import('./rule-engine').RuleCondition[] | null;
            return RuleEngine.evaluate(conditions, entityPayload);
        }) || null;
    }

    /**
     * Initializes the approval gate for a given entity and state transition.
     * Looks up the ProcessGatePolicy, and if found, creates the first UniversalApprovalInstance (Level 1).
     */
    static async startGate(params: {
        entityType: string;
        entityId: string;
        currentStatus: string;
        /** Target status. See findMatchingPolicy: pass it whenever the transition has one. */
        toStatus?: string;
        entityPayload?: Record<string, unknown>;
        makerId?: string; // Add makerId parameter
    }) {
        const { entityType, entityId, currentStatus, toStatus, entityPayload = {}, makerId } = params;

        // 1. Find all active policies for this transition (fromStatus, and toStatus when known)
        const policies = await prisma.processGatePolicy.findMany({
            where: {
                entityType,
                fromStatus: currentStatus,
                ...(toStatus ? { toStatus } : {}),
                isEnabled: true
            },
            include: {
                approvalLevels: {
                    orderBy: { level: 'asc' }
                }
            }
        });

        const { RuleEngine } = await import('./rule-engine');

        // Find the first policy that satisfies the conditions
        const policy = policies.find(p => {
            const conditions = p.conditions as import('./rule-engine').RuleCondition | import('./rule-engine').RuleCondition[] | null;
            return RuleEngine.evaluate(conditions, entityPayload);
        });

        if (!policy) {
            // No configured policy means this transition has no approval gate.
            return { status: 'GATE_PASSED', policyToStatus: undefined };
        }
        if (policy.approvalLevels.length === 0) {
            throw AppError.badRequest(`Workflow policy ${policy.label} is enabled but has no approval levels; refusing to bypass the gate.`);
        }

        const policyLevels = policy.approvalLevels.filter((level) => level.policyVariant === 'DEFAULT');
        if (policyLevels.length === 0) {
            throw AppError.badRequest(`Workflow policy ${policy.label} has no DEFAULT approval configuration; refusing to bypass the gate.`);
        }
        policyLevels.forEach((level) => assertCanonicalLevel(level, `${policy.entityType} level ${level.level}`));

        // Dynamic Evidence Gating
        if (policy.reqPhotoProof && (!entityPayload.photoUrls || (Array.isArray(entityPayload.photoUrls) && entityPayload.photoUrls.length === 0))) {
            throw AppError.badRequest('Transition Blocked: Photo evidence is required by the workflow policy.');
        }
        if (policy.reqOpmcPat && entityPayload.opmcPatStatus !== 'ACCEPTED') {
            throw AppError.badRequest('Transition Blocked: OPMC PAT Acceptance is required by the workflow policy.');
        }
        if (policy.reqHoPat && entityPayload.hoPatStatus !== 'ACCEPTED') {
            throw AppError.badRequest('Transition Blocked: HO PAT Acceptance is required by the workflow policy.');
        }

        // 2. Start at the first step that applies. A step can be skipped when nobody holding it exists in the entity's area.
        const queueMode = Boolean((policy as { queueMode?: boolean }).queueMode);
        const scope = queueMode ? await loadGateScope(prisma as unknown as Prisma.TransactionClient, entityType, entityId) : undefined;
        const startIndex = await resolveApplicableLevel(prisma as unknown as Prisma.TransactionClient, policyLevels, 0, scope);
        if (startIndex < 0) {
            throw AppError.badRequest(`Workflow policy ${policy.label} has no step that applies to this ${entityType}.`);
        }
        const firstLevel = policyLevels[startIndex];
        const firstLevelPolicy = assertCanonicalLevel(firstLevel, `${policy.entityType} level ${firstLevel.level}`);

        // A queue gate has no single assigned approver and sends no per-entity email: approvers work from the queue page.
        let approverId: string | undefined;
        let approverEmail: string | null | undefined;
        if (!queueMode) {
            const approver = await findCanonicalApprover(prisma as unknown as Prisma.TransactionClient, firstLevel);
            approverId = approver?.id;
            approverEmail = approver?.email;

            // Handle Out-Of-Office (OOO) Auto-Delegation
            if (approver?.isOOO && approver.delegatedUserId) {
                const delegate = await findCanonicalApprover(
                    prisma as unknown as Prisma.TransactionClient,
                    { ...firstLevel, specificUserId: approver.delegatedUserId },
                );
                if (delegate) {
                    console.log(`[ProcessGateEngine] Approver ${approver.email} was OOO. Auto-delegated approval to ${delegate.email}`);
                    approverId = delegate.id;
                    approverEmail = delegate.email;
                }
            }

            if (!approverId || !approverEmail) {
                 throw AppError.badRequest(`Cannot dispatch approval: no active canonical approver is configured for ${firstLevel.requiredRole}.`);
            }
        }

        // 3. Create UniversalApprovalInstance for the first step
        const instanceData: CreateUniversalApprovalInstancePayload = {
            entityId,
            entityType,
            policyId: policy.id,
            levelIndex: startIndex,
            level: firstLevel.level,
            requiredRole: firstLevel.requiredRole,
            requiredPermission: firstLevelPolicy.requiredPermission,
            eligibleRoles: firstLevelPolicy.eligibleRoles,
            policyVariant: 'DEFAULT',
            assignedUserId: approverId ?? null,
            makerId: makerId, // Assign Maker for SoD checks later
            status: 'PENDING'
        };

        const instance = await prisma.universalApprovalInstance.create({
            data: instanceData as unknown as Prisma.UniversalApprovalInstanceUncheckedCreateInput
        });

        // 4. Dispatch Event for External Listeners (Zero-Coding Webhook pattern)
        try {
            if (approverEmail && approverId) {
                await notifyApprover({ instanceId: instance.id, entityType, entityId, approverEmail, approverId, requiredRole: firstLevel.requiredRole });
            }
            console.log(`[ProcessGateEngine] Dispatched Level ${firstLevel.level} Approval for Policy ${policy.label}`);
        } catch (emailErr) {
            console.error(`[ProcessGateEngine] Failed to dispatch email for ${entityType}:`, emailErr);
        }

        return { status: 'GATE_STARTED', instanceId: instance.id, policyId: policy.id, level: firstLevel.level, requiredRole: firstLevel.requiredRole };
    }

    /**
     * Advances the gate when a user approves or rejects an instance.
     * Supports Multi-Level auto-advancement (Level 1 -> Level 2 -> Level 3),
     * Cryptographic Signature Hashes, Universal SoD, and Flexible Rejection Loops.
     */
    static async advanceGate(params: {
        instanceId: string;
        action: 'APPROVED' | 'REJECTED';
        userId: string;
        remarks?: string;
        payload?: Record<string, unknown>;
    }) {
        const { instanceId, action, userId, remarks, payload } = params;
        let notifyNext: Parameters<typeof notifyApprover>[0] | undefined;

        const result = await prisma.$transaction(async (tx) => {
            const instance = await tx.universalApprovalInstance.findUnique({
                where: { id: instanceId }
            });

            if (!instance) throw AppError.notFound('Approval instance not found.');
            if (instance.status !== 'PENDING') throw AppError.badRequest(`This request has already been ${instance.status.toLowerCase()}.`);

            const policy = instance.policyId
                ? await tx.processGatePolicy.findUnique({
                    where: { id: instance.policyId },
                    include: { approvalLevels: { orderBy: { level: 'asc' } } },
                })
                : null;
            const currentPolicyLevel = policy?.approvalLevels.find((level) =>
                level.policyVariant === instance.policyVariant && level.level === instance.level
            );
            const requiredPermission = instance.requiredPermission ?? currentPolicyLevel?.requiredPermission ?? null;
            const eligibleRoles = instance.eligibleRoles ?? currentPolicyLevel?.eligibleRoles ?? null;
            const effectiveLevel = currentPolicyLevel ?? {
                level: instance.level,
                requiredRole: instance.requiredRole,
                requiredPermission,
                eligibleRoles,
                specificUserId: instance.assignedUserId,
            };
            const canonicalPolicy = assertCanonicalLevel(effectiveLevel, `${instance.entityType} level ${instance.level}`);

            // Verify the actor against canonical DB role assignments. User.role
            // is compatibility data and must not authorize an approval action.
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    status: true,
                    contractorId: true,
                    accessibleOpmcs: { select: { id: true } },
                    permissions: true,
                    systemRole: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } },
                    sectionAssignments: { select: { role: { select: { code: true, isActive: true, permissions: true, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } } } },
                },
            });
            if (!user || user.status !== 'active') {
                throw AppError.unauthorized('Authenticated approval actor is not active.');
            }

            const capabilities = deriveEffectivePermissions(user);
            const isAdmin = capabilities.includes(RBAC_PERMISSIONS.ADMIN_RBAC);
            if (!capabilities.includes(canonicalPolicy.requiredPermission)) {
                throw AppError.forbidden(`${canonicalPolicy.requiredPermission} is required for this approval action.`);
            }
            const queueMode = Boolean((policy as { queueMode?: boolean } | null)?.queueMode);
            const scope = queueMode ? await loadGateScope(tx as unknown as Prisma.TransactionClient, instance.entityType, instance.entityId) : undefined;
            if (queueMode) {
                // Queue gate: the actor must hold the step inside the entity's area (or be the entity's own contractor)
                const actor = { ...user, accessibleOpmcIds: user.accessibleOpmcs.map((o) => o.id) };
                if (!mayActOnLevel(actor, capabilities, { ...effectiveLevel, assignee: (currentPolicyLevel as { assignee?: string } | undefined)?.assignee }, scope)) {
                    throw AppError.forbidden('You are not authorized to action this request.');
                }
            } else {
                const hasRequiredRole = hasEligibleCanonicalRole(user, canonicalPolicy.eligibleRoles);
                if (!isAdmin && instance.assignedUserId !== userId && !hasRequiredRole) {
                    throw AppError.forbidden('You are not authorized to action this request.');
                }
            }

            // Universal Segregation of Duties (Maker != Checker) Security
            // Using O(1) lookup from the stored Maker ID instead of rigid switch cases querying specific tables
            const typedForMaker = instance as typeof instance & { makerId?: string | null };
            const requesterId = typedForMaker.makerId;

            if (requesterId && requesterId === userId) {
                throw AppError.forbidden("Segregation of Duties Violation: You cannot act as Checker (Approver) on an entity you created/own as Maker.");
            }

            // Generate Cryptographic Digital Signature Hash
            const timestamp = new Date().toISOString();
            const rawSignatureData = `${instanceId}:${userId}:${action}:${timestamp}:${requireEnv('JWT_SECRET')}`;
            const signatureHash = crypto.createHash('sha256').update(rawSignatureData).digest('hex');

            // 1. Update current instance to APPROVED/REJECTED with signatureHash
            const updatedInstanceData: UpdateUniversalApprovalInstancePayload = {
                status: action,
                actionedBy: { connect: { id: userId } },
                actionedAt: new Date(),
                comments: remarks || `Actioned via ProcessGateEngine (${action})`,
                payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
                signatureHash
            };

            await tx.universalApprovalInstance.update({
                where: { id: instanceId },
                data: updatedInstanceData as unknown as Prisma.UniversalApprovalInstanceUpdateInput
            });

            // Cast instance for extended fields
            const typedInstance = instance as typeof instance & { policyId?: string | null; levelIndex?: number | null };

            // Handle Rejection Workflow
            if (action === 'REJECTED') {
                let rejectionBehavior = 'PERMANENT_CANCEL';
                if (typedInstance.policyId) {
                    const pol = await tx.processGatePolicy.findUnique({ where: { id: typedInstance.policyId } });
                    const typedPol = pol as typeof pol & { rejectionBehavior?: string | null };
                    if (typedPol?.rejectionBehavior) {
                        rejectionBehavior = typedPol.rejectionBehavior;
                    }
                }

                return {
                    status: 'GATE_REJECTED',
                    rejectionBehavior,
                    entityType: instance.entityType,
                    entityId: instance.entityId,
                    actionedById: userId,
                    instanceId: instance.id,
                    signatureHash
                };
            }

            // If policy found and has multiple levels, check if there is a next level
            const currentLevelIndex = typedInstance.levelIndex ?? 0;
            const policyLevels = policy?.approvalLevels.filter((level) => level.policyVariant === instance.policyVariant) ?? [];
            policyLevels.forEach((level) => assertCanonicalLevel(level, `${instance.entityType} level ${level.level}`));
            // The next step that applies (a step is skipped when nobody holding it exists in the entity's area)
            const nextLevelIndex = policy ? await resolveApplicableLevel(tx as unknown as Prisma.TransactionClient, policyLevels, currentLevelIndex + 1, scope) : -1;
            if (policy && nextLevelIndex >= 0) {
                const nextLevel = policyLevels[nextLevelIndex];
                const nextLevelPolicy = assertCanonicalLevel(nextLevel, `${instance.entityType} level ${nextLevel.level}`);

                // A queue gate has no single assigned approver and sends no per-entity email
                let nextApproverId: string | undefined;
                let nextApproverEmail: string | null | undefined;
                if (!queueMode) {
                    const nextApprover = await findCanonicalApprover(tx as unknown as Prisma.TransactionClient, nextLevel);
                    nextApproverId = nextApprover?.id;
                    nextApproverEmail = nextApprover?.email;

                    if (!nextApproverId || !nextApproverEmail) {
                        throw AppError.badRequest(`Cannot advance approval: no active canonical approver is configured for ${nextLevel.requiredRole}.`);
                    }

                    // Handle OOO Delegation for next approver
                    if (nextApprover?.isOOO && nextApprover.delegatedUserId) {
                        const delegate = await findCanonicalApprover(
                            tx as unknown as Prisma.TransactionClient,
                            { ...nextLevel, specificUserId: nextApprover.delegatedUserId },
                        );
                        if (delegate?.email) {
                            nextApproverId = delegate.id;
                            nextApproverEmail = delegate.email;
                        }
                    }
                }

                const nextInstanceData: CreateUniversalApprovalInstancePayload = {
                    entityId: instance.entityId,
                    entityType: instance.entityType,
                    policyId: policy.id,
                    levelIndex: nextLevelIndex,
                    level: nextLevel.level,
                    requiredRole: nextLevel.requiredRole,
                    requiredPermission: nextLevelPolicy.requiredPermission,
                    eligibleRoles: nextLevelPolicy.eligibleRoles,
                    policyVariant: instance.policyVariant,
                    assignedUserId: nextApproverId ?? null,
                    makerId: (instance as typeof instance & { makerId?: string | null }).makerId ?? undefined,
                    status: 'PENDING'
                };

                const nextInstance = await tx.universalApprovalInstance.create({
                    data: nextInstanceData as unknown as Prisma.UniversalApprovalInstanceUncheckedCreateInput
                });

                if (nextApproverId && nextApproverEmail) {
                    notifyNext = { instanceId: nextInstance.id, entityType: instance.entityType, entityId: instance.entityId, approverEmail: nextApproverEmail, approverId: nextApproverId, requiredRole: nextLevel.requiredRole };
                }
                console.log(`[ProcessGateEngine] Gate Advanced: Level ${instance.level} APPROVED -> Created Level ${nextLevel.level} for ${nextApproverEmail || nextLevel.requiredRole}`);

                return {
                    status: 'GATE_ADVANCED',
                    nextLevel: nextLevel.level,
                    nextInstanceId: nextInstance.id,
                    entityType: instance.entityType,
                    entityId: instance.entityId,
                    signatureHash
                };
            }

            // All levels completed - Final Gate Passed!
            const typedPolicy = policy as typeof policy & { domainAction?: string | null };
            let domainActionResult: unknown;
            // A policy saved without an action still has to apply its status (see gate-default-action.ts)
            const domainAction = typedPolicy?.domainAction || defaultGateDomainAction(instance.entityType, policy?.toStatus);
            if (domainAction) {
                // Domain actions are part of the same transaction as the final
                // approval. A missing/unsupported action must roll back the
                // approval instead of leaving a falsely completed gate behind.
                domainActionResult = await DomainActionDispatcher.dispatch({
                    action: domainAction,
                    entityId: instance.entityId,
                    entityType: instance.entityType,
                    userId,
                    instanceId: instance.id,
                    metadata: {
                        ...(payload || {}),
                        targetStatus: policy?.toStatus,
                    },
                }, tx);
            }
            return {
                status: 'GATE_PASSED',
                policyToStatus: policy?.toStatus,
                domainActionUrl: domainAction,
                domainActionResult,
                entityType: instance.entityType,
                entityId: instance.entityId,
                actionedById: userId,
                instanceId: instance.id,
                signatureHash
            };
        }, { timeout: 30_000, maxWait: 10_000 });

        // The next approver is told only after the approval is saved (an email failure must never undo an approval)
        if (notifyNext) {
            try { await notifyApprover(notifyNext); } catch (emailErr) { console.error(`[ProcessGateEngine] Failed to notify the next approver for ${notifyNext.entityType}:`, emailErr); }
        }

        return result;
    }
}
