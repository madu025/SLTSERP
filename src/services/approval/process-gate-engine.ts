import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { DynamicApprovalService } from './dynamic-approval.service';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export interface CreateUniversalApprovalInstancePayload {
    entityId: string;
    entityType: string;
    policyId?: string;
    levelIndex?: number;
    level: number;
    requiredRole: string;
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

export class ProcessGateEngine {
    /**
     * Resolves the matching ProcessGatePolicy for an entity and current status using the RuleEngine.
     */
    static async findMatchingPolicy(params: {
        entityType: string;
        fromStatus: string;
        entityPayload?: Record<string, unknown>;
    }) {
        const { entityType, fromStatus, entityPayload = {} } = params;

        const policies = await prisma.processGatePolicy.findMany({
            where: {
                entityType,
                fromStatus,
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
        entityPayload?: Record<string, unknown>;
        makerId?: string; // Add makerId parameter
    }) {
        const { entityType, entityId, currentStatus, entityPayload = {}, makerId } = params;

        // 1. Find all active policies for this transition based on currentStatus (which is fromStatus)
        const policies = await prisma.processGatePolicy.findMany({
            where: {
                entityType,
                fromStatus: currentStatus,
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

        if (!policy || policy.approvalLevels.length === 0) {
            // No policy or no levels found, automatically pass the gate
            return { status: 'GATE_PASSED', policyToStatus: undefined };
        }

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
        const firstLevel = policy.approvalLevels[0];

        // Determine approver user
        let approver = null;
        if (firstLevel.specificUserId) {
            approver = await prisma.user.findUnique({ where: { id: firstLevel.specificUserId, status: 'ACTIVE' } });
        } else {
            approver = await prisma.user.findFirst({
                where: { role: firstLevel.requiredRole as import('@prisma/client').Role, status: 'ACTIVE' }
            });
        }

        // Handle Out-Of-Office (OOO) Auto-Delegation
        if (approver?.isOOO && approver.delegatedUserId) {
            const delegate = await prisma.user.findUnique({ where: { id: approver.delegatedUserId, status: 'ACTIVE' } });
            if (delegate) {
                console.log(`[ProcessGateEngine] Approver ${approver.email} was OOO. Auto-delegated approval to ${delegate.email}`);
                approver = delegate;
            }
        }

        const approverEmail = approver?.email; 
        const approverId = approver?.id;

        if (!approverEmail) {
             const fallbackEmail = process.env.NEXT_PUBLIC_DEV_EMAIL || process.env.DEV_FALLBACK_EMAIL;
             if (fallbackEmail) {
                  console.warn(`[ProcessGateEngine] Approver has no email. Using fallback: ${fallbackEmail}`);
             } else {
                  throw AppError.badRequest(`Cannot dispatch approval: Approver for role ${firstLevel.requiredRole} has no valid email address.`);
             }
        }

        // 3. Create UniversalApprovalInstance for Level 1
        const instanceData: CreateUniversalApprovalInstancePayload = {
            entityId,
            entityType,
            policyId: policy.id,
            levelIndex: 0,
            level: firstLevel.level,
            requiredRole: firstLevel.requiredRole,
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
            if (approverEmail || process.env.NEXT_PUBLIC_DEV_EMAIL) {
                const targetEmail = approverEmail || process.env.NEXT_PUBLIC_DEV_EMAIL || process.env.DEV_FALLBACK_EMAIL;
                if (targetEmail) {
                    await DynamicApprovalService.sendMaterialRequestEmail(
                        instance.id,
                        entityId,
                        targetEmail,
                        approverId || '',
                        firstLevel.requiredRole
                    );
                }
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

            // Verify assigned user / role permissions
            if (instance.assignedUserId && instance.assignedUserId !== userId) {
                const user = await tx.user.findUnique({ where: { id: userId } });
                if (user?.role !== 'SUPER_ADMIN' && user?.role !== instance.requiredRole) {
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
            const rawSignatureData = `${instanceId}:${userId}:${action}:${timestamp}:${process.env.JWT_SECRET || 'sltserp_secret'}`;
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

            // 2. Fetch associated ProcessGatePolicy and multi-level chain
            let policy = null;
            if (typedInstance.policyId) {
                policy = await tx.processGatePolicy.findUnique({
                    where: { id: typedInstance.policyId },
                    include: { approvalLevels: { orderBy: { level: 'asc' } } }
                });
            }

            // If policy found and has multiple levels, check if there is a next level
            const currentLevelIndex = typedInstance.levelIndex ?? 0;
            if (policy && policy.approvalLevels.length > currentLevelIndex + 1) {
                const nextLevelIndex = currentLevelIndex + 1;
                const nextLevel = policy.approvalLevels[nextLevelIndex];

                // Determine approver for next level
                let nextApprover = null;
                if (nextLevel.specificUserId) {
                    nextApprover = await tx.user.findUnique({ where: { id: nextLevel.specificUserId, status: 'ACTIVE' } });
                } else {
                    nextApprover = await tx.user.findFirst({
                        where: { role: nextLevel.requiredRole as import('@prisma/client').Role, status: 'ACTIVE' }
                    });
                }

                // Handle OOO Delegation for next approver
                if (nextApprover?.isOOO && nextApprover.delegatedUserId) {
                    const delegate = await tx.user.findUnique({ where: { id: nextApprover.delegatedUserId, status: 'ACTIVE' } });
                    if (delegate) nextApprover = delegate;
                }

                const nextInstanceData: CreateUniversalApprovalInstancePayload = {
                    entityId: instance.entityId,
                    entityType: instance.entityType,
                    policyId: policy.id,
                    levelIndex: nextLevelIndex,
                    level: nextLevel.level,
                    requiredRole: nextLevel.requiredRole,
                    assignedUserId: nextApprover?.id,
                    status: 'PENDING'
                };

                const nextInstance = await tx.universalApprovalInstance.create({
                    data: nextInstanceData as unknown as Prisma.UniversalApprovalInstanceUncheckedCreateInput
                });

                console.log(`[ProcessGateEngine] Gate Advanced: Level ${instance.level} APPROVED -> Created Level ${nextLevel.level} for ${nextApprover?.email || nextLevel.requiredRole}`);

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
            return {
                status: 'GATE_PASSED',
                policyToStatus: policy?.toStatus,
                domainActionUrl: typedPolicy?.domainAction,
                entityType: instance.entityType,
                entityId: instance.entityId,
                actionedById: userId,
                instanceId: instance.id,
                signatureHash
            };
        });

        // 3. Dispatch Webhook (Zero-Coding Action Trigger)
        if (result.status === 'GATE_PASSED' && result.domainActionUrl) {
            try {
                // Background fire-and-forget
                const isRelative = result.domainActionUrl.startsWith('/');
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const webhookUrl = isRelative ? `${baseUrl}${result.domainActionUrl}` : result.domainActionUrl;
                
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'GATE_PASSED',
                        data: result,
                        payload: payload || {}
                    })
                }).catch(err => console.error(`[ProcessGateEngine] Webhook fetch failed for ${webhookUrl}:`, err));
                
                console.log(`[ProcessGateEngine] Triggered Webhook: ${webhookUrl}`);
            } catch (err) {
                console.error('[ProcessGateEngine] Webhook dispatch error:', err);
            }
        }

        return result;
    }
}
