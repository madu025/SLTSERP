import { prisma } from '@/lib/prisma';

interface CreatePermitInput {
    projectId: string;
    permitTypeId: string;
    permitNumber?: string | null;
    applicationDate?: string | Date | null;
    expiryDate?: string | Date | null;
    status?: string;
    cost?: number | null;
}

export class ProjectPermitService {
    /**
     * Get list of permits
     */
    static async getPermits(projectId?: string | null) {
        const where: Record<string, unknown> = {};
        if (projectId) where.projectId = projectId;

        const permits = await prisma.projectPermit.findMany({
            where,
            include: {
                permitType: true,
                _count: { select: { permitDocuments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return permits;
    }

    /**
     * Create a new permit
     */
    static async createPermit(data: CreatePermitInput) {
        const {
            projectId,
            permitTypeId,
            permitNumber,
            applicationDate,
            expiryDate,
            status,
            cost
        } = data;

        const permit = await prisma.projectPermit.create({
            data: {
                projectId,
                permitTypeId,
                permitNumber: permitNumber || null,
                applicationDate: applicationDate ? new Date(applicationDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                status: status || 'DRAFT',
                cost: cost || null
            },
            include: {
                permitType: true,
                _count: { select: { permitDocuments: true } }
            }
        });

        return permit;
    }

    /**
     * Get permit types
     */
    static async getPermitTypes(isActive?: boolean | null, authorityId?: string | null) {
        const where: Record<string, unknown> = {};

        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive;
        }
        if (authorityId) {
            where.authorityId = authorityId;
        }

        const permitTypes = await prisma.permitType.findMany({
            where,
            include: {
                authority: {
                    select: {
                        id: true,
                        name: true,
                        shortName: true,
                        contactPerson: true,
                        contactNumber: true,
                        email: true,
                        isActive: true
                    }
                },
                _count: {
                    select: {
                        permits: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return permitTypes;
    }
}
