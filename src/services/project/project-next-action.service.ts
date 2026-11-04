import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { FINANCE_STAGE_ROLES, FINANCE_TEAM_ROLES } from '@/lib/workflow-finance-roles';

export type NextActionKind = 'PLAN_SETUP' | 'PLAN_WAITING' | 'ASSIGN_SUPERVISOR' | 'APPROVE_PLAN' | 'APPROVAL_STEP' | 'STAGE' | 'ASSIGN_FINANCE';

export interface NextAction {
    id: string;
    kind: NextActionKind;
    projectId: string;
    projectCode: string;
    projectName: string;
    title: string;
    detail: string;
    link: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    /** True when the user cannot act yet (blocked by someone else's step); shown greyed out. */
    waiting: boolean;
}

const CLOSED = ['COMPLETED', 'CANCELLED'];
const MAX_PER_KIND = 25;

/** Same suffix rule the workflow engine uses: OSP_MANAGER matches NEW_CONNECTION_OSP_MANAGER. */
export function holdsRole(userRoleCodes: string[], stageRole: string): boolean {
    const wanted = stageRole.trim().replace(/_GLOBAL$/, '');
    if (!wanted) return false;
    return userRoleCodes.some((code) => {
        const have = code.trim().replace(/_GLOBAL$/, '');
        return have === wanted || have.endsWith(`_${wanted}`);
    });
}

/**
 * "What should I do next?" for a signed-in user. Notifications say something happened; this answers
 * what is now waiting on you, derived from live state (no stored tasks to drift out of date):
 * a supervisor sees the plan to build, a manager sees projects with no supervisor and plans to
 * approve, an approver sees their approval step, a stage owner sees the stage they must finish.
 */
const COUNT_TTL_MS = 60_000;
const countCache = new Map<string, { at: number; count: number }>();

export class ProjectNextActionService {
    /** Actionable (not waiting) items for the sidebar badge. Cached briefly: the sidebar polls often. */
    static async countForUser(userId: string): Promise<number> {
        const hit = countCache.get(userId);
        if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.count;
        const count = (await this.listForUser(userId)).filter((a) => !a.waiting).length;
        countCache.set(userId, { at: Date.now(), count });
        return count;
    }

    static async listForUser(userId: string): Promise<NextAction[]> {
        const [scope, permissions, user] = await Promise.all([
            resolveOpmcScope(userId),
            getUserEffectivePermissions(userId),
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    systemRole: { select: { code: true, isActive: true } },
                    sectionAssignments: { select: { role: { select: { code: true, isActive: true } } } },
                },
            }),
        ]);
        const projectScope = scope === undefined ? {} : { opmcId: { in: scope } };
        const activeProject = { status: { notIn: CLOSED as never[] }, ...projectScope };
        const roleCodes = [
            user?.systemRole?.isActive ? user.systemRole.code : null,
            ...(user?.sectionAssignments ?? []).map((a) => (a.role.isActive ? a.role.code : null)),
        ].filter((c): c is string => !!c);

        const actions: NextAction[] = [];
        const ref = (p: { id: string; projectCode: string; name: string }) => ({ projectId: p.id, projectCode: p.projectCode, projectName: p.name });

        // 1. Supervisor: build and submit the task plan for each project they were assigned to.
        const assignments = await prisma.projectSupervisorAssignment.findMany({
            where: { supervisorId: userId, status: 'ASSIGNED', project: activeProject },
            select: { project: { select: { id: true, projectCode: true, name: true } } },
            take: 100,
        });
        if (assignments.length) {
            const ids = assignments.map((a) => a.project.id);
            const [plans, boqs] = await Promise.all([
                prisma.projectTaskPlan.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, status: true, _count: { select: { items: true } } } }),
                prisma.bOQApproval.findMany({ where: { projectId: { in: ids }, status: 'APPROVED' }, select: { projectId: true } }),
            ]);
            const planByProject = new Map(plans.map((p) => [p.projectId, p]));
            const boqApproved = new Set(boqs.map((b) => b.projectId));
            for (const { project } of assignments) {
                const plan = planByProject.get(project.id);
                const link = `/projects/${project.id}?tab=tasks`;
                if (plan && !['DRAFT', 'CHANGES_REQUESTED', 'SUBMITTED'].includes(plan.status)) continue; // approved and generated: tasks now live in the task list
                if (!boqApproved.has(project.id)) {
                    actions.push({
                        id: `plan-wait-boq:${project.id}`, kind: 'PLAN_WAITING', ...ref(project), link, priority: 'LOW', waiting: true,
                        title: 'Waiting for BOQ approval',
                        detail: 'You are the project supervisor. The task plan can be built once the BOQ is approved; you will be told when it is.',
                    });
                } else if (plan?.status === 'SUBMITTED') {
                    actions.push({
                        id: `plan-submitted:${project.id}`, kind: 'PLAN_WAITING', ...ref(project), link, priority: 'LOW', waiting: true,
                        title: 'Task plan waiting for approval',
                        detail: 'You submitted the plan. A project manager will approve it; the tasks are generated and assigned when they do.',
                    });
                } else if (!plan) {
                    actions.push({
                        id: `plan-start:${project.id}`, kind: 'PLAN_SETUP', ...ref(project), link, priority: 'HIGH', waiting: false,
                        title: 'Start the task plan',
                        detail: 'The BOQ is approved. Open Tasks, click Start Plan, then add tasks and assign each one to a person or contractor.',
                    });
                } else {
                    actions.push({
                        id: `plan-configure:${project.id}`, kind: 'PLAN_SETUP', ...ref(project), link, priority: 'HIGH', waiting: false,
                        title: 'Finish the task plan',
                        detail: `Draft plan has ${plan._count.items} item${plan._count.items === 1 ? '' : 's'}. Assign every task, then click Submit for approval.`,
                    });
                }
            }
        }

        // 2. Manager: projects that still have no supervisor, and plans waiting for approval.
        if (permissions.includes(RBAC_PERMISSIONS.PROJECT_WRITE)) {
            const projects = await prisma.project.findMany({
                where: activeProject,
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: { id: true, projectCode: true, name: true },
            });
            if (projects.length) {
                const withSupervisor = new Set(
                    (await prisma.projectSupervisorAssignment.findMany({
                        where: { projectId: { in: projects.map((p) => p.id) }, status: 'ASSIGNED' },
                        select: { projectId: true },
                    })).map((a) => a.projectId),
                );
                for (const project of projects.filter((p) => !withSupervisor.has(p.id)).slice(0, MAX_PER_KIND)) {
                    actions.push({
                        id: `assign-supervisor:${project.id}`, kind: 'ASSIGN_SUPERVISOR', ...ref(project), priority: 'MEDIUM', waiting: false,
                        link: `/projects/${project.id}?tab=tasks`,
                        title: 'Assign a project supervisor',
                        detail: 'No supervisor yet. Open Tasks, choose a supervisor and click Assign; they build the task plan.',
                    });
                }
            }
        }
        if (permissions.includes(RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE)) {
            const plans = await prisma.projectTaskPlan.findMany({
                where: { status: 'SUBMITTED', configuredById: { not: userId }, project: activeProject, items: { some: {} } },
                take: MAX_PER_KIND,
                select: { project: { select: { id: true, projectCode: true, name: true } }, _count: { select: { items: true } } },
            });
            const approved = new Set(
                (await prisma.bOQApproval.findMany({ where: { projectId: { in: plans.map((p) => p.project.id) }, status: 'APPROVED' }, select: { projectId: true } })).map((b) => b.projectId),
            );
            for (const plan of plans.filter((p) => approved.has(p.project.id))) {
                actions.push({
                    id: `plan-approve:${plan.project.id}`, kind: 'APPROVE_PLAN', ...ref(plan.project), priority: 'MEDIUM', waiting: false,
                    link: `/projects/${plan.project.id}?tab=tasks`,
                    title: 'Approve the submitted task plan',
                    detail: `${plan._count.items} planned item${plan._count.items === 1 ? '' : 's'}. Approving generates the project tasks and tells each assignee.`,
                });
            }
        }

        // 3. Approver: an approval step assigned to me whose earlier steps are already approved.
        const steps = await prisma.projectApprovalStep.findMany({
            where: { assignedUserId: userId, status: 'PENDING', request: { status: 'PENDING', project: activeProject } },
            take: 100,
            select: {
                stepNumber: true,
                request: { select: { id: true, title: true, project: { select: { id: true, projectCode: true, name: true } }, steps: { select: { stepNumber: true, status: true } } } },
            },
        });
        for (const step of steps) {
            if (step.request.steps.some((s) => s.stepNumber < step.stepNumber && s.status !== 'APPROVED')) continue;
            actions.push({
                id: `approval:${step.request.id}`, kind: 'APPROVAL_STEP', ...ref(step.request.project), priority: 'HIGH', waiting: false,
                link: `/projects/${step.request.project.id}?tab=approvals`,
                title: `Approve: ${step.request.title}`,
                detail: `Your approval (step ${step.stepNumber}) is the next one needed.`,
            });
        }

        // 4. Stage owner: the project's current stage belongs to me, by name or by role.
        const stages = await prisma.projectStageInstance.findMany({
            where: {
                status: 'IN_PROGRESS',
                projectWorkflowInstance: { project: activeProject },
                OR: [{ assignedUserId: userId }, { assignedRole: { not: null } }],
            },
            take: 300,
            select: {
                id: true, name: true, sequence: true, assignedRole: true, assignedUserId: true,
                projectWorkflowInstance: { select: { project: { select: { id: true, projectCode: true, name: true } } } },
            },
        });
        let financeProjects: Set<string> | null = null;
        for (const stage of stages) {
            let mine = stage.assignedUserId ? stage.assignedUserId === userId : !!stage.assignedRole && holdsRole(roleCodes, stage.assignedRole);
            if (!mine && !stage.assignedUserId && stage.assignedRole && FINANCE_STAGE_ROLES.includes(stage.assignedRole)) {
                // Invoice stages belong to the project's assigned finance team (see WorkflowNotificationService.ownersOf).
                financeProjects ??= new Set((await prisma.projectFinanceAssignment.findMany({
                    where: { userId, status: 'ACTIVE', assignmentRole: { in: [...FINANCE_TEAM_ROLES] } }, select: { projectId: true },
                })).map((a) => a.projectId));
                mine = financeProjects.has(stage.projectWorkflowInstance.project.id);
            }
            if (!mine) continue;
            const project = stage.projectWorkflowInstance.project;
            actions.push({
                id: `stage:${stage.id}`, kind: 'STAGE', ...ref(project), priority: 'MEDIUM', waiting: false,
                link: `/projects/${project.id}`,
                title: `Complete stage ${stage.sequence}: ${stage.name}`,
                detail: 'This stage is yours. Finish its checklist, tasks and approvals, then mark it complete to hand over to the next owner.',
            });
        }

        // Manager: an invoice stage is active but the project has no finance team, so nobody can pick it up.
        if (permissions.includes(RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN)) {
            const invoiceStages = stages.filter((st) => st.assignedRole && FINANCE_STAGE_ROLES.includes(st.assignedRole));
            if (invoiceStages.length) {
                const ids = [...new Set(invoiceStages.map((st) => st.projectWorkflowInstance.project.id))];
                const staffed = new Set((await prisma.projectFinanceAssignment.findMany({
                    where: { projectId: { in: ids }, status: 'ACTIVE', assignmentRole: { in: [...FINANCE_TEAM_ROLES] } }, select: { projectId: true },
                })).map((a) => a.projectId));
                for (const st of invoiceStages) {
                    const project = st.projectWorkflowInstance.project;
                    if (staffed.has(project.id)) continue;
                    actions.push({
                        id: `assign-finance:${project.id}`, kind: 'ASSIGN_FINANCE', ...ref(project), priority: 'HIGH', waiting: false,
                        link: `/projects/${project.id}`,
                        title: 'Assign the project finance team',
                        detail: `"${st.name}" is active but no preparer or lead controller is assigned, so nobody is told about invoices.`,
                    });
                }
            }
        }

        const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
        return actions.sort((a, b) => Number(a.waiting) - Number(b.waiting) || rank[a.priority] - rank[b.priority]);
    }
}
