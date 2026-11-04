import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification/notification.service';

import { FINANCE_STAGE_ROLES, FINANCE_TEAM_ROLES } from '@/lib/workflow-finance-roles';

/** Cap per event: a role shared by many users must not turn one hand-off into a broadcast. */
const MAX_RECIPIENTS = 25;

interface StageRef {
    id: string;
    name: string;
    assignedRole?: string | null;
    assignedUserId?: string | null;
}

/**
 * Tells the next owner of a workflow step that it is their turn, so nobody has to phone them.
 * Recipients are the stage's named user, else every active user holding the stage role whose OPMC
 * scope covers the project. Delivery failures never block the workflow action that triggered them.
 */
export class WorkflowNotificationService {
    /** Active users holding any of the roles (suffix-matching like the workflow role checks), in scope. */
    static async resolveRecipients(projectId: string, roleCodes: string[], excludeUserId?: string | null): Promise<string[]> {
        const codes = roleCodes.map(code => code.trim().replace(/_GLOBAL$/, '')).filter(Boolean);
        if (codes.length === 0) return [];

        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { opmcId: true } });
        // A project without an OPMC has no scoped owners; the caller falls back to project managers.
        if (!project?.opmcId) return [];

        const roleMatch = {
            isActive: true,
            OR: codes.flatMap(code => [{ code }, { code: `${code}_GLOBAL` }, { code: { endsWith: `_${code}` } }]),
        };
        // The OPMC scope is part of the query, not a post-filter: a common role such as ENGINEER has
        // hundreds of holders nationwide, so capping first and filtering after would drop the
        // few who are actually in scope. Users with the global capability are not matched here.
        const candidates = await prisma.user.findMany({
            where: {
                status: 'active',
                id: excludeUserId ? { not: excludeUserId } : undefined,
                accessibleOpmcs: { some: { id: project.opmcId } },
                OR: [{ systemRole: roleMatch }, { sectionAssignments: { some: { role: roleMatch } } }],
            },
            select: { id: true },
            take: MAX_RECIPIENTS,
        });
        return candidates.map(c => c.id);
    }

    private static async deliver(params: {
        projectId: string;
        recipients: string[];
        title: string;
        message: string;
        priority?: 'HIGH' | 'MEDIUM';
        dedupBase: string;
        metadata: Record<string, unknown>;
        fallbackToManagers?: boolean;
        link?: string;
    }): Promise<number> {
        const { projectId, recipients, title, message, priority = 'HIGH', dedupBase, metadata } = params;
        const link = params.link ?? `/projects/${projectId}`;
        for (const userId of recipients) {
            await NotificationService.send({
                userId, title, message, type: 'PROJECT', priority,
                link,
                metadata: { projectId, ...metadata },
                dedupKey: `${dedupBase}:${userId}`,
            });
        }
        if (recipients.length === 0 && params.fallbackToManagers) {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { opmcId: true } });
            await NotificationService.notifyByAudience({
                audience: 'PROJECT_MANAGERS',
                title: `${title} (no owner found)`,
                message: `${message} No active user holds the owning role, so assign one.`,
                type: 'PROJECT', priority,
                link,
                opmcId: project?.opmcId ?? undefined,
                metadata: { projectId, ...metadata },
                dedupKey: `${dedupBase}:managers`,
            });
        }
        return recipients.length;
    }

    /**
     * Notify the holders of an approval role on one project (document approvals, BOQ levels). Replaces the
     * ADMINISTRATORS broadcast that told ~250 people about every approval; falls back to the OPMC's
     * project managers only when nobody in scope holds the role.
     */
    static async notifyRoleHolders(params: {
        projectId: string;
        roleCodes: string[];
        title: string;
        message: string;
        link: string;
        dedupBase: string;
        metadata?: Record<string, unknown>;
        excludeUserId?: string | null;
    }): Promise<number> {
        try {
            const recipients = await this.resolveRecipients(params.projectId, params.roleCodes, params.excludeUserId);
            return await this.deliver({
                projectId: params.projectId, recipients, title: params.title, message: params.message,
                dedupBase: params.dedupBase, metadata: params.metadata ?? {}, link: params.link, fallbackToManagers: true,
            });
        } catch (error) {
            console.error('Failed to notify approval role holders:', error);
            return 0;
        }
    }

    private static async projectLabel(projectId: string): Promise<string> {
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, projectCode: true } });
        return project ? `${project.name} (${project.projectCode})` : 'a project';
    }

    private static async ownersOf(projectId: string, stage: StageRef, excludeUserId?: string | null): Promise<string[]> {
        if (stage.assignedUserId) return stage.assignedUserId === excludeUserId ? [] : [stage.assignedUserId];
        const holders = stage.assignedRole ? await this.resolveRecipients(projectId, [stage.assignedRole], excludeUserId) : [];
        if (holders.length > 0 || !stage.assignedRole || !FINANCE_STAGE_ROLES.includes(stage.assignedRole)) return holders;
        // Invoice stages are owned by contractor/invoice roles that staff usually do not hold. The people who
        // actually do the work are the project's assigned finance team, so use them rather than a manager broadcast.
        const team = await prisma.projectFinanceAssignment.findMany({
            where: { projectId, status: 'ACTIVE', assignmentRole: { in: [...FINANCE_TEAM_ROLES] }, userId: excludeUserId ? { not: excludeUserId } : undefined },
            select: { userId: true },
        });
        return [...new Set(team.map((t) => t.userId))];
    }

    /** A stage just became the active one. */
    static async notifyStageStarted(projectId: string, stage: StageRef, actorId: string): Promise<void> {
        try {
            const recipients = await this.ownersOf(projectId, stage, actorId);
            await this.deliver({
                projectId, recipients,
                title: `▶️ Your turn: ${stage.name}`,
                message: `The previous stage on ${await this.projectLabel(projectId)} is complete. "${stage.name}" is now active and waiting on you.`,
                dedupBase: `workflow-stage:${stage.id}`,
                metadata: { stageId: stage.id, event: 'STAGE_STARTED' },
                fallbackToManagers: true,
            });
        } catch (error) {
            console.error('Failed to send workflow stage hand-off notification:', error);
        }
    }

    /** An approval level is now due (first level on submission, later levels after the one before). */
    static async notifyApprovalDue(
        projectId: string,
        approval: { id: string; level: number; role: string; eligibleRoles: unknown },
        stageName: string,
        actorId: string,
    ): Promise<void> {
        try {
            const roles = Array.isArray(approval.eligibleRoles)
                ? approval.eligibleRoles.filter((r): r is string => typeof r === 'string')
                : [approval.role];
            const recipients = await this.resolveRecipients(projectId, roles.length ? roles : [approval.role], actorId);
            await this.deliver({
                projectId, recipients,
                title: `✅ Approval needed: ${stageName}`,
                message: `Level ${approval.level} approval for "${stageName}" on ${await this.projectLabel(projectId)} is waiting on you.`,
                dedupBase: `workflow-approval:${approval.id}`,
                metadata: { approvalId: approval.id, event: 'APPROVAL_DUE' },
                fallbackToManagers: true,
            });
        } catch (error) {
            console.error('Failed to send workflow approval notification:', error);
        }
    }

    /** After a level is approved, the lowest level still pending becomes due. */
    static async notifyNextApprovalLevel(projectId: string, stageId: string, stageName: string, actorId: string): Promise<void> {
        try {
            const next = await prisma.projectApprovalInstance.findFirst({
                where: { stageId, status: 'PENDING' },
                orderBy: { level: 'asc' },
                select: { id: true, level: true, role: true, eligibleRoles: true },
            });
            if (next) await this.notifyApprovalDue(projectId, next, stageName, actorId);
        } catch (error) {
            console.error('Failed to resolve the next workflow approval level:', error);
        }
    }

    /** The approval chain finished or was rejected: tell the stage owner and, when rejected, why it came back. */
    static async notifyApprovalOutcome(
        projectId: string,
        stage: StageRef,
        outcome: 'ALL_APPROVED' | 'REJECTED',
        actorId: string,
    ): Promise<void> {
        try {
            const recipients = await this.ownersOf(projectId, stage, actorId);
            const approved = outcome === 'ALL_APPROVED';
            await this.deliver({
                projectId, recipients,
                title: approved ? `🎉 Approved: ${stage.name}` : `↩️ Changes requested: ${stage.name}`,
                message: approved
                    ? `All approval levels for "${stage.name}" on ${await this.projectLabel(projectId)} are done. You can complete the stage.`
                    : `An approver rejected "${stage.name}" on ${await this.projectLabel(projectId)}. Rework it and resubmit.`,
                dedupBase: `workflow-approval-outcome:${stage.id}:${outcome}:${Date.now()}`,
                metadata: { stageId: stage.id, event: `APPROVAL_${outcome}` },
            });
        } catch (error) {
            console.error('Failed to send workflow approval outcome notification:', error);
        }
    }

    /** A deliverable was submitted for review. */
    static async notifyReviewSubmitted(
        projectId: string,
        review: { id: string; reviewerRole: string | null; deliverableType: string | null; revision: number },
        stageName: string,
        actorId: string,
    ): Promise<void> {
        try {
            const recipients = review.reviewerRole ? await this.resolveRecipients(projectId, [review.reviewerRole], actorId) : [];
            await this.deliver({
                projectId, recipients,
                title: `🔍 Review needed: ${stageName}`,
                message: `${review.deliverableType || 'A deliverable'} (revision ${review.revision}) on ${await this.projectLabel(projectId)} was submitted and needs your review.`,
                dedupBase: `workflow-review:${review.id}`,
                metadata: { reviewId: review.id, event: 'REVIEW_SUBMITTED' },
                fallbackToManagers: true,
            });
        } catch (error) {
            console.error('Failed to send workflow review notification:', error);
        }
    }

    /** A review was decided: the submitter learns the result, and on approval the next stage owner is told. */
    static async notifyReviewDecision(
        projectId: string,
        review: { id: string; submittedById: string | null; revision: number },
        decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
        stage: StageRef,
        nextStage: StageRef | null,
        actorId: string,
    ): Promise<void> {
        try {
            if (review.submittedById && review.submittedById !== actorId) {
                const approved = decision === 'APPROVED';
                await this.deliver({
                    projectId, recipients: [review.submittedById],
                    title: approved ? `✅ Review approved: ${stage.name}` : `↩️ Review ${decision === 'REJECTED' ? 'rejected' : 'needs changes'}: ${stage.name}`,
                    message: approved
                        ? `Revision ${review.revision} of "${stage.name}" on ${await this.projectLabel(projectId)} was approved.`
                        : `Revision ${review.revision} of "${stage.name}" on ${await this.projectLabel(projectId)} needs rework. See the review comments.`,
                    dedupBase: `workflow-review-decision:${review.id}`,
                    metadata: { reviewId: review.id, event: `REVIEW_${decision}` },
                });
            }
            if (decision === 'APPROVED' && nextStage) {
                const recipients = await this.ownersOf(projectId, nextStage, actorId);
                await this.deliver({
                    projectId, recipients,
                    title: `📥 Hand-off ready: ${nextStage.name}`,
                    message: `"${stage.name}" was approved on ${await this.projectLabel(projectId)}; the work is ready to be picked up for "${nextStage.name}".`,
                    dedupBase: `workflow-handoff:${review.id}`,
                    metadata: { reviewId: review.id, toStageId: nextStage.id, event: 'HANDOFF_READY' },
                    fallbackToManagers: true,
                });
            }
        } catch (error) {
            console.error('Failed to send workflow review decision notification:', error);
        }
    }
}
