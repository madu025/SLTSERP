import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface AllocateResourceInput {
    resourceType: string;
    resourceId: string;
    name: string;
    role?: string;
    allocationPercentage?: string | number;
    startDate: string | Date;
    endDate: string | Date;
}

export class ProjectResourceService {
    static async getResources(projectId: string) {
        const allocated = await prisma.projectResource.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });

        const staff = await prisma.staff.findMany({
            select: { id: true, name: true, designation: true }
        });

        const teams = await prisma.contractorTeam.findMany({
            select: { id: true, name: true, contractor: { select: { name: true } } }
        });

        return {
            allocated,
            available: {
                staff: staff.map(s => ({ id: s.id, name: `${s.name} (${s.designation})`, type: 'STAFF' })),
                teams: teams.map(t => ({ id: t.id, name: `${t.name} - ${t.contractor.name}`, type: 'TEAM' }))
            }
        };
    }

    static async allocateResource(projectId: string, data: AllocateResourceInput) {
        const { resourceType, resourceId, name, role, allocationPercentage, startDate, endDate } = data;

        const overlaps = await prisma.projectResource.findMany({
            where: {
                resourceId,
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(startDate) }
            }
        });

        const currentAllocationSum = overlaps.reduce((sum, r) => sum + r.allocationPercentage, 0);
        const newTotal = currentAllocationSum + Number(allocationPercentage || 100);

        const isOverloaded = newTotal > 100;

        const newResource = await prisma.projectResource.create({
            data: {
                projectId,
                resourceType,
                resourceId,
                name,
                role: role || null,
                allocationPercentage: Number(allocationPercentage || 100),
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            }
        });

        return {
            resource: newResource,
            warning: isOverloaded ? `Warning: Resource total loading will be ${newTotal}% during this period.` : null
        };
    }

    static async removeResource(resourceAllocationId: string) {
        await prisma.projectResource.delete({
            where: { id: resourceAllocationId }
        });
        return { success: true };
    }
}
