import { prisma } from '@/lib/prisma';

interface CreatePermitInput {
    projectId: string;
    permitTypeId: string;
    permitNumber?: string | null;
    applicationDate?: string | Date | null;
    expiryDate?: string | Date | null;
    status?: string;
    cost?: number | null;
    remarks?: string | null;
    appliedById?: string | null;
}

export class ProjectPermitService {
    static async getPermits(projectId?: string | null, status?: string | null) {
        const where: Record<string, unknown> = {};
        if (projectId) where.projectId = projectId;
        if (status) where.status = status;

        const permits = await prisma.projectPermit.findMany({
            where,
            include: {
                permitType: {
                    include: {
                        authority: {
                            select: {
                                id: true,
                                name: true,
                                shortName: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        permitDocuments: true,
                        approvalSteps: true
                    }
                }
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
            cost,
            remarks,
            appliedById
        } = data;

        const permit = await prisma.projectPermit.create({
            data: {
                projectId,
                permitTypeId,
                permitNumber: permitNumber || null,
                applicationDate: applicationDate ? new Date(applicationDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                status: status || 'DRAFT',
                cost: cost || null,
                remarks: remarks || null,
                appliedById: appliedById || null
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

    static async getPermit(projectId: string, permitId: string) {
        return await prisma.projectPermit.findFirst({
            where: {
                id: permitId,
                projectId
            },
            include: {
                permitType: {
                    include: {
                        authority: {
                            select: {
                                id: true,
                                name: true,
                                shortName: true,
                                contactPerson: true,
                                contactNumber: true,
                                email: true,
                                address: true
                            }
                        }
                    }
                },
                permitDocuments: {
                    orderBy: { uploadedAt: "desc" }
                },
                approvalSteps: {
                    orderBy: { stepNumber: "asc" }
                }
            }
        });
    }

    static async updatePermit(permitId: string, data: any) {
        return await prisma.projectPermit.update({
            where: { id: permitId },
            data,
            include: {
                permitType: { include: { authority: { select: { id: true, name: true, shortName: true } } } },
                permitDocuments: { orderBy: { uploadedAt: "desc" } },
                approvalSteps: { orderBy: { stepNumber: "asc" } }
            }
        });
    }

    static async deletePermit(permitId: string) {
        return await prisma.projectPermit.delete({ where: { id: permitId } });
    }
}
