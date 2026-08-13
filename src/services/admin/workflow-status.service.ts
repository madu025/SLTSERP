import { prisma } from '@/lib/prisma';

interface WorkflowStatusEntry {
    value: string;
    label: string;
    badgeColor: string | null;
}

export class WorkflowStatusService {
    static async getGroupedStatuses(): Promise<Record<string, WorkflowStatusEntry[]>> {
        const statuses = await prisma.workflowStatus.findMany({
            orderBy: { createdAt: 'asc' }
        });

        const grouped: Record<string, WorkflowStatusEntry[]> = {};
        for (const s of statuses) {
            if (!grouped[s.entityType]) {
                grouped[s.entityType] = [];
            }
            grouped[s.entityType].push({
                value: s.value,
                label: s.label,
                badgeColor: s.badgeColor
            });
        }

        return grouped;
    }
}
