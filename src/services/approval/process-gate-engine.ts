import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { requireEnv } from '@/lib/env';
import { DynamicApprovalService } from './dynamic-approval.service';
import { DomainActionDispatcher } from './domain-dispatcher.service';
import { Prisma } from '@prisma/client';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { isCanonicalPermission, RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import crypto from 'crypto';

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
};

function parseEligibleRoles(value: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map((role) => role.trim().replace(/_GLOBAL$/, ''));
}

function assertCanonicalLevel(level: ApprovalPolicyLevel, context: string) {
    if (!level.requiredPermission || !isCanonicalPermission(level.requiredPermission)) {
        throw AppError.badRequest(`Workflow policy is incomplete: ${context} requires a valid canonical approval permission.`);
    }
    const eligibleRoles = parseEligibleRoles(level.eligibleRoles);
    if (!level.specificUserId && eligibleRoles.length === 0) {
        throw AppError.badRequest(`Workflow policy is incomplete: ${context} requires canonical eligible role assignments.`);
    }
    return { requiredPermission: level.requiredPermission, eligibleRoles };
}

function hasEligibleCanonicalRole(
    user: { systemRole?: { code: string; isActive: boolean } | null; sectionAssignments: Array<{ role: { code: string; isActive: boolean } }> },
    eligibleRoles: readonly string[],
) {
    if (eligibleRoles.length === 0) return false;
    const activeRoles = [
        user.systemRole,
        ...user.sectionAssignments.map((assignment) => assignment.role),
    ].filter((role): role is { code: string; isActive: boolean } => Boolean(role?.isActive));
    return activeRoles.some((role) => eligibleRoles.some((eligible) => {
        const code = role.code.replace(/_GLOBAL$/, '');
        return code === eligible || code.endsWith(`_${eligible}`);
    }));
}

async function findCanonicalApprover(
    client: Prisma.TransactionClient,
    level: ApprovalPolicyLevel,
) {
    const { requiredPermission, eligibleRoles } = assertCanonicalLevel(level, `level ${level.level}`);
    const users = await client.user.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            email: true,
            isOOO: true,
            delegatedUserId: true,
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
        return deriveEffectivePermissions(user).includes(requiredPermission);
    });
    // The person who holds the eligible role gets the approval. An RBAC admin can always act, but is only the
    // assignee when nobody with the role exists: taking the first match in table order used to hand approvals that
    // a role holder could have actioned to an admin account instead.
    return candidates.find((user) => hasEligibleCanonicalRole(user, eligibleRoles))
        ?? candidates.find((user) => deriveEffectivePermissions(user).includes(RBAC_PERMISSIONS.ADMIN_RBAC))
        ?? null;
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

        // 2. Start at Level 1 (Index 0)
        const firstLevel = policyLevels[0];
        const firstLevelPolicy = assertCanonicalLevel(firstLevel, `${policy.entityType} level ${firstLevel.level}`);

        // Determine approver user
        const approver = await findCanonicalApprover(prisma as unknown as Prisma.TransactionClient, firstLevel);
        let approverId = approver?.id;
        let approverEmail = approver?.email;

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

        // 3. Create UniversalApprovalInstance for Level 1
        const instanceData: CreateUniversalApprovalInstancePayload = {
            entityId,
            entityType,
            policyId: policy.id,
            levelIndex: 0,
            level: firstLevel.level,
            requiredRole: firstLevel.requiredRole,
            requiredPermission: firstLevelPolicy.requiredPermission,
            eligibleRoles: firstLevelPolicy.eligibleRoles,
            policyVariant: 'DEFAULT',
            assignedUserId: approverId,
            makerId: makerId, // Assign Maker for SoD checks later
            status: 'PENDING'
        };

        const instance = await prisma.universalApprovalInstance.create({
            data: instanceData as unknown as Prisma.UniversalApprovalInstanceUncheckedCreateInput
        });

        // 4. Dispatch Event for External Listeners (Zero-Coding Webhook pattern)
        // Instead of hardcoding email sends, we emit an event or return dispatch details.
        // We will keep a generic email dispatch here, but remove the hardcoded check.
        try {
            if (approverEmail) {
                await DynamicApprovalService.sendMaterialRequestEmail(
                    instance.id,
                    entityId,
                    approverEmail,
                    approverId,
                    firstLevel.requiredRole
                );
            }
            console.log(`[ProcessGateEngine] Dispatched Level ${firstLevel.level} Approval for Policy ${policy.label}`);
        } catch (emailErr) {
            console.error(`[ProcessGateEngine] Failed to dispatch email for ${entityType}:`, emailErr);
        }

        return { status: 'GATE_STARTED', instanceId: instance.id, policyId: policy.id };
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
            const hasRequiredRole = hasEligibleCanonicalRole(user, canonicalPolicy.eligibleRoles);

            if (!isAdmin && instance.assignedUserId !== userId && !hasRequiredRole) {
                throw AppError.forbidden('You are not authorized to action this request.');
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
            if (policy && policyLevels.length > currentLevelIndex + 1) {
                const nextLevelIndex = currentLevelIndex + 1;
                const nextLevel = policyLevels[nextLevelIndex];
                const nextLevelPolicy = assertCanonicalLevel(nextLevel, `${instance.entityType} level ${nextLevel.level}`);

                // Determine approver for next level
                const nextApprover = await findCanonicalApprover(tx as unknown as Prisma.TransactionClient, nextLevel);
                let nextApproverId = nextApprover?.id;
                let nextApproverEmail = nextApprover?.email;

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
                    assignedUserId: nextApproverId,
                    status: 'PENDING'
                };

                const nextInstance = await tx.universalApprovalInstance.create({
                    data: nextInstanceData as unknown as Prisma.UniversalApprovalInstanceUncheckedCreateInput
                });

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
            if (typedPolicy?.domainAction) {
                // Domain actions are part of the same transaction as the final
                // approval. A missing/unsupported action must roll back the
                // approval instead of leaving a falsely completed gate behind.
                domainActionResult = await DomainActionDispatcher.dispatch({
                    action: typedPolicy.domainAction,
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
                domainActionUrl: typedPolicy?.domainAction,
                domainActionResult,
                entityType: instance.entityType,
                entityId: instance.entityId,
                actionedById: userId,
                instanceId: instance.id,
                signatureHash
            };
        });

        return result;
    }
}
