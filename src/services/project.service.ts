import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { calculateProjectProgress } from '@/lib/project-progress';

interface ProjectFilters {
    status?: string | null;
    type?: string | null;
    opmcId?: string | null;
    contractorId?: string | null;
    projectTypeId?: string | null;
    search?: string | null;
}

interface CreateProjectInput {
    projectCode: string;
    name: string;
    type?: string;
    contractorId?: string | null;
    opmcId?: string | null;
    projectTypeId?: string | null;
}

interface UpdateProjectInput {
    name?: string;
    description?: string | null;
    type?: string;
    location?: string | null;
    status?: string;
    progress?: string | number;
    budget?: string | number | null;
    actualCost?: string | number;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    estimatedDuration?: string | number | null;
    actualDuration?: string | number | null;
    areaManagerId?: string | null;
    contractorId?: string | null;
    opmcId?: string | null;
}

export class ProjectService {
    /**
     * Get all projects with optional filters and pagination
     */
    static async getProjects(filters: ProjectFilters, pagination: { page?: number; limit?: number; isPaginated?: boolean }) {
        const { status, type, opmcId, contractorId, projectTypeId, search } = filters;
        const { page = 1, limit = 50, isPaginated = false } = pagination;
        const skip = (page - 1) * limit;

        const where: Record<string, any> = {};

        if (status && status !== 'ALL') {
            where.status = status;
        } else {
            where.status = { not: 'COMPLETED' };
        }
        if (type && type !== 'ALL') where.type = type;
        if (opmcId && opmcId !== 'ALL') where.opmcId = opmcId;
        if (contractorId && contractorId !== 'ALL') where.contractorId = contractorId;
        if (projectTypeId && projectTypeId !== 'ALL') where.projectTypeId = projectTypeId;

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { projectCode: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip: isPaginated ? skip : undefined,
                take: isPaginated ? limit : 100, // safety cap to prevent database lockups
                include: {
                    opmc: {
                        select: {
                            id: true,
                            rtom: true,
                            region: true
                        }
                    },
                    areaManager: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    contractor: {
                        select: {
                            id: true,
                            name: true,
                            contactNumber: true
                        }
                    },
                    projectType: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    },
                    _count: {
                        select: {
                            boqItems: true,
                            milestones: true,
                            expenses: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.project.count({ where })
        ]);

        if (isPaginated) {
            return {
                projects,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        }

        return projects;
    }

    /**
     * Get single project full details
     */
    static async getProjectDetails(id: string) {
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                opmc: {
                    select: {
                        id: true,
                        rtom: true,
                        region: true,
                        province: true
                    }
                },
                areaManager: {
                    select: {
                        id: true,
                        name: true,
                        designation: true
                    }
                },
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        contactNumber: true,
                        email: true
                    }
                },
                projectType: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                workflowInstance: {
                    include: {
                        stages: {
                            orderBy: { sequence: 'asc' },
                            include: {
                                tasks: true,
                                checklists: true,
                                approvals: true,
                            },
                        },
                    },
                },
                boqItems: {
                    include: {
                        material: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true
                            }
                        }
                    },
                    orderBy: {
                        itemCode: 'asc'
                    }
                },
                milestones: {
                    orderBy: {
                        targetDate: 'asc'
                    }
                },
                expenses: {
                    orderBy: {
                        date: 'desc'
                    }
                },
                invoices: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        amount: true,
                        status: true,
                        date: true
                    }
                }
            }
        });

        if (!project) throw new Error('PROJECT_NOT_FOUND');
        return project;
    }

    /**
     * Create new project
     */
    static async createProject(data: CreateProjectInput) {
        const { projectCode, name, type, contractorId, opmcId, projectTypeId } = data;

        // Check if project code already exists
        const existing = await prisma.project.findUnique({
            where: { projectCode }
        });

        if (existing) {
            throw new Error('PROJECT_CODE_EXISTS');
        }

        const project = await prisma.project.create({
            data: {
                projectCode,
                name,
                type: type || 'FTTH',
                contractorId: contractorId || null,
                opmcId: opmcId || null,
                projectTypeId: projectTypeId || null,
                status: 'PLANNING'
            },
            include: {
                opmc: true,
                areaManager: true,
                contractor: true,
                projectType: {
                    select: { id: true, name: true, description: true }
                }
            }
        });

        // Auto-generate ProjectWorkflowInstance if projectTypeId is provided
        if (project.projectTypeId) {
            try {
                await WorkflowEngine.initializeProjectWorkflow(project.id, project.projectTypeId);
            } catch (wfError) {
                console.warn('Workflow auto-initialization skipped:', wfError);
                // Don't fail the project creation if workflow init fails
            }
        }

        return project;
    }

    /**
     * Update project details
     */
    static async updateProject(id: string, updateData: UpdateProjectInput) {
        const existingProject = await prisma.project.findUnique({
            where: { id },
            include: { workflowInstance: true }
        });

        if (!existingProject) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        const hasActiveWorkflow = !!existingProject.workflowInstance;

        // Construct clean payload matching Prisma input type constraints
        const finalUpdateData: Record<string, unknown> = {};

        if (updateData.name !== undefined) finalUpdateData.name = updateData.name;
        if (updateData.description !== undefined) finalUpdateData.description = updateData.description || null;
        if (updateData.type !== undefined) finalUpdateData.type = updateData.type;
        if (updateData.location !== undefined) finalUpdateData.location = updateData.location || null;
        if (updateData.opmcId !== undefined) finalUpdateData.opmcId = updateData.opmcId || null;
        if (updateData.contractorId !== undefined) finalUpdateData.contractorId = updateData.contractorId || null;
        if (updateData.areaManagerId !== undefined) finalUpdateData.areaManagerId = updateData.areaManagerId || null;

        if (updateData.startDate !== undefined) {
            finalUpdateData.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
        }
        if (updateData.endDate !== undefined) {
            finalUpdateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
        }
        if (updateData.budget !== undefined) {
            finalUpdateData.budget = updateData.budget !== null ? parseFloat(String(updateData.budget)) : null;
        }
        if (updateData.actualCost !== undefined) {
            finalUpdateData.actualCost = parseFloat(String(updateData.actualCost));
        }
        if (updateData.estimatedDuration !== undefined) {
            finalUpdateData.estimatedDuration = updateData.estimatedDuration !== null ? parseInt(String(updateData.estimatedDuration), 10) : null;
        }
        if (updateData.actualDuration !== undefined) {
            finalUpdateData.actualDuration = updateData.actualDuration !== null ? parseInt(String(updateData.actualDuration), 10) : null;
        }

        if (updateData.progress !== undefined) {
            if (hasActiveWorkflow) {
                console.warn(`Blocking manual progress write of ${updateData.progress}% for project ${id} because it has an active workflow.`);
            } else {
                finalUpdateData.progress = parseFloat(String(updateData.progress));
            }
        }

        if (updateData.status !== undefined) {
            if (hasActiveWorkflow) {
                console.warn(`Blocking manual status write of ${updateData.status} for project ${id} because it has an active workflow.`);
            } else {
                finalUpdateData.status = updateData.status;
            }
        }

        const project = await prisma.project.update({
            where: { id },
            data: finalUpdateData,
            include: {
                opmc: true,
                areaManager: true,
                contractor: true
            }
        });

        // Trigger programmatic recalculation of progress and status if project has an active workflow
        let finalProject = project;
        if (hasActiveWorkflow) {
            await calculateProjectProgress(id);
            // Re-fetch project to return updated progress/status
            const updatedProject = await prisma.project.findUnique({
                where: { id },
                include: {
                    opmc: true,
                    areaManager: true,
                    contractor: true
                }
            });
            if (updatedProject) finalProject = updatedProject;
        }

        // Automatically remove project from QFieldCloud if status is COMPLETED
        if (finalProject.status === 'COMPLETED' && finalProject.gisMapping) {
            const gisMapping = finalProject.gisMapping as Record<string, unknown>;
            const qfieldProjectId = gisMapping?.qfieldProjectId as string;
            if (qfieldProjectId) {
                try {
                    const { QFieldCloudSyncService } = await import('@/services/qfieldcloud-sync.service');
                    const syncService = new QFieldCloudSyncService();
                    await syncService.deleteQFieldProject(qfieldProjectId);
                    console.log(`✅ Automatically removed QFieldCloud project ${qfieldProjectId} because project ${id} was marked as COMPLETED.`);
                } catch (qfieldErr) {
                    console.error('Failed to automatically remove QFieldCloud project for completed project:', qfieldErr);
                }
            }
        }

        return finalProject;
    }

    /**
     * Delete project and its associated QFieldCloud project if mapped
     */
    static async deleteProject(id: string, userRole?: string | null) {
        const isDev = process.env.NODE_ENV === 'development';
        if (!isDev && (!userRole || !['SUPER_ADMIN', 'ADMIN'].includes(userRole))) {
            throw new Error('FORBIDDEN');
        }

        // Verify project exists and get gisMapping
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        // Delete from QFieldCloud if mapped
        if (project.gisMapping) {
            const gisMapping = project.gisMapping as Record<string, unknown>;
            const qfieldProjectId = gisMapping?.qfieldProjectId as string;
            if (qfieldProjectId) {
                try {
                    const { QFieldCloudSyncService } = await import('@/services/qfieldcloud-sync.service');
                    const syncService = new QFieldCloudSyncService();
                    await syncService.deleteQFieldProject(qfieldProjectId);
                    console.log(`✅ Deleted QFieldCloud project ${qfieldProjectId} for deleted project ${id}`);
                } catch (qfieldErr) {
                    console.error('Failed to delete project from QFieldCloud:', qfieldErr);
                }
            }
        }

        await prisma.project.delete({
            where: { id }
        });

        return { success: true };
    }
}
