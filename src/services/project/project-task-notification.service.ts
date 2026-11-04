import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { NotificationService } from '@/services/notification/notification.service';

export const MY_TASKS_LINK = '/projects/my-tasks';

export interface AssignedTaskRef {
    userId: string;
    taskName: string;
}

/**
 * Tells project staff that work has been assigned to them, and lists that work back to them.
 * Assignment is only delivered once a task exists: plan items stay private until the plan is
 * approved and generated, so callers invoke this from generation, not from draft edits.
 */
export class ProjectTaskNotificationService {
    /** One grouped in-app notification per user per project (repeats bump groupedCount). */
    static async notifyAssigned(projectId: string, assignments: AssignedTaskRef[], actorId: string): Promise<void> {
        const byUser = new Map<string, string[]>();
        for (const { userId, taskName } of assignments) {
            if (!userId || userId === actorId) continue;
            byUser.set(userId, [...(byUser.get(userId) || []), taskName]);
        }
        if (byUser.size === 0) return;

        try {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, projectCode: true } });
            const projectLabel = project ? `${project.name} (${project.projectCode})` : 'a project';
            for (const [userId, names] of byUser) {
                const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
                await NotificationService.send({
                    userId,
                    title: '📋 New Project Task Assigned',
                    message: `${names.length} task${names.length > 1 ? 's' : ''} assigned to you in ${projectLabel}: ${preview}.`,
                    type: 'PROJECT',
                    priority: 'MEDIUM',
                    link: MY_TASKS_LINK,
                    metadata: { projectId, taskCount: names.length },
                    dedupKey: `project-task-assigned:${projectId}:${userId}`,
                });
            }
        } catch (error) {
            console.error('Failed to send project task assignment notifications:', error);
        }
    }

    /** Tells a user they were given a standing role on a project (supervisor, finance controller, ...). */
    static async notifyRoleAssigned(projectId: string, userId: string, roleLabel: string, actorId: string, nextStep?: string): Promise<void> {
        if (!userId || userId === actorId) return;
        try {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, projectCode: true } });
            const projectLabel = project ? `${project.name} (${project.projectCode})` : 'a project';
            await NotificationService.send({
                userId,
                title: '👤 Assigned to a Project',
                // Say what to do next and open the queue that lists it, so the recipient is never left guessing.
                message: `You have been assigned as ${roleLabel} on ${projectLabel}.${nextStep ? ` Next: ${nextStep}` : ''}`,
                type: 'PROJECT',
                priority: 'MEDIUM',
                link: nextStep ? MY_TASKS_LINK : `/projects/${projectId}`,
                metadata: { projectId, role: roleLabel },
                dedupKey: `project-role-assigned:${projectId}:${userId}:${roleLabel}`,
            });
        } catch (error) {
            console.error('Failed to send project role assignment notification:', error);
        }
    }

    /** Open work assigned to the viewer, limited to the OPMC scope they may access. */
    static async listForUser(userId: string) {
        const scope = await resolveOpmcScope(userId);
        const projectScope = scope === undefined ? {} : { project: { opmcId: { in: scope } } };

        const [tasks, fieldTasks] = await Promise.all([
            prisma.projectTask.findMany({
                where: { assignedUserId: userId, status: { not: 'COMPLETED' }, ...projectScope },
                orderBy: [{ plannedEndDate: 'asc' }, { createdAt: 'desc' }],
                take: 500,
                select: {
                    id: true, name: true, wbsCode: true, status: true, priority: true,
                    plannedStartDate: true, plannedEndDate: true, actualProgress: true,
                    project: { select: { id: true, name: true, projectCode: true } },
                },
            }),
            prisma.fieldTask.findMany({
                where: { assignedUserId: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, ...projectScope },
                orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
                take: 500,
                select: {
                    id: true, title: true, status: true, priority: true, scheduledDate: true, address: true,
                    project: { select: { id: true, name: true, projectCode: true } },
                },
            }),
        ]);

        return {
            tasks: tasks.map(t => ({ ...t, actualProgress: Number(t.actualProgress) })),
            fieldTasks,
        };
    }
}
