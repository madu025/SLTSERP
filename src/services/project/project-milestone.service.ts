import { prisma } from '@/lib/prisma';

interface CreateMilestoneInput {
    projectId: string;
    name: string;
    description?: string;
    targetDate: string | Date;
    status?: string;
}

interface UpdateMilestoneInput {
    name?: string;
    description?: string;
    targetDate?: string | Date;
    completedDate?: string | Date;
    status?: string;
    progress?: number;
}

export class ProjectMilestoneService {
    /**
     * Get all milestones for a project
     */
    static async getMilestones(projectId: string) {
        const milestones = await prisma.projectMilestone.findMany({
            where: { projectId },
            orderBy: { targetDate: 'asc' }
        });
        return milestones;
    }

    /**
     * Create a milestone
     */
    static async createMilestone(data: CreateMilestoneInput) {
        const { projectId, name, description, targetDate, status } = data;

        const milestone = await prisma.projectMilestone.create({
            data: {
                projectId,
                name,
                description: description || null,
                targetDate: new Date(targetDate),
                status: status || 'PENDING',
                progress: 0
            }
        });

        return milestone;
    }

    /**
     * Update a milestone
     */
    static async updateMilestone(id: string, updateData: UpdateMilestoneInput) {
        const data: Record<string, unknown> = { ...updateData };

        if (updateData.targetDate) data.targetDate = new Date(updateData.targetDate);
        if (updateData.completedDate) data.completedDate = new Date(updateData.completedDate);

        // Auto update completedDate if status changes to COMPLETED
        if (updateData.status === 'COMPLETED' && !updateData.completedDate) {
            data.completedDate = new Date();
            data.progress = 100;
        }

        const milestone = await prisma.projectMilestone.update({
            where: { id },
            data
        });

        return milestone;
    }

    /**
     * Delete a milestone
     */
    static async deleteMilestone(id: string) {
        await prisma.projectMilestone.delete({
            where: { id }
        });
        return { success: true };
    }
}
