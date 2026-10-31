import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { calculateProjectProgress } from '@/lib/project-progress';
import { NIL_UUID } from '@/lib/opmc-scope';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { getProjectTypeCatalogEntry } from '@/config/project-type-catalog';
import { assertProjectAccess } from '@/lib/project-access';
import { getIncompleteClosureStages, isInvoiceOpenForClosure } from './project-closure';

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
    projectTypeId: string;
    parentId?: string | null;
    planningSource?: string;
    actorUserId?: string | null;
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
    parentId?: string | null;
    planningSource?: string;
}

export class ProjectService {
    /**
     * Get all projects with optional filters and pagination
     */
    static async getProjects(filters: ProjectFilters, pagination: { page?: number; limit?: number; isPaginated?: boolean }, accessibleOpmcs?: string[]) {
        const { status, type, opmcId, contractorId, projectTypeId, search } = filters;
        const { page = 1, limit = 50, isPaginated = false } = pagination;
        const skip = (page - 1) * limit;

        const where: Prisma.ProjectWhereInput = {};

        if (status && status !== 'ALL') {
            where.status = status as import("@prisma/client").ProjectStatus;
        } else if (!status) {
            where.status = { not: 'COMPLETED' };
        }
        if (type && type !== 'ALL') where.type = type;
        // Tri-state OPMC isolation: undefined = admin/global; [] = deny all.
        // A client-supplied opmcId filter is intersected with the resolved
        // scope — values outside it are ignored.
        if (accessibleOpmcs !== undefined) {
            if (opmcId && opmcId !== 'ALL') {
                where.opmcId = accessibleOpmcs.includes(opmcId) ? opmcId : NIL_UUID;
            } else {
                where.opmcId = accessibleOpmcs.length > 0 ? { in: accessibleOpmcs } : NIL_UUID;
            }
        } else if (opmcId && opmcId !== 'ALL') {
            where.opmcId = opmcId;
        }
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
                    parent: { select: { id: true, projectCode: true, name: true } },
                    contractorAssignments: {
                        where: { status: 'ACTIVE' },
                        include: { contractor: { select: { id: true, name: true } } },
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
                parent: { select: { id: true, projectCode: true, name: true } },
                children: { select: { id: true, projectCode: true, name: true, status: true, progress: true } },
                contractorAssignments: {
                    include: { contractor: { select: { id: true, name: true, contactNumber: true, email: true } } },
                    orderBy: { assignedAt: 'asc' },
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

        if (!project) throw AppError.badRequest('PROJECT_NOT_FOUND');
        return project;
    }

    /**
     * Create new project
     */
    static async createProject(data: CreateProjectInput) {
        const { projectCode, name, type, contractorId, opmcId, projectTypeId, parentId, planningSource, actorUserId } = data;

        if (!projectTypeId) throw AppError.badRequest('PROJECT_TYPE_REQUIRED');
        const accessibleOpmcs = actorUserId === undefined ? undefined : await resolveOpmcScope(actorUserId);
        if (accessibleOpmcs !== undefined && (!opmcId || !accessibleOpmcs.includes(opmcId))) {
            throw AppError.forbidden('Project OPMC is outside the authenticated user scope');
        }

        const requestedPlanningSource = planningSource?.trim().toUpperCase();
        if (requestedPlanningSource && !['GIS', 'CAD', 'MANUAL'].includes(requestedPlanningSource)) {
            throw AppError.badRequest('Planning source must be GIS, CAD, or MANUAL');
        }

        // Check if project code already exists
        const existing = await prisma.project.findUnique({
            where: { projectCode }
        });

        if (existing) {
            throw AppError.badRequest('PROJECT_CODE_EXISTS');
        }

        // Resolve an explicitly selected type, or use the first type that has an active
        // template.  A project without a usable workflow is not a valid project record.
        return await prisma.$transaction(async (tx) => {
            if (parentId) {
                const parent = await tx.project.findUnique({ where: { id: parentId }, select: { id: true, opmcId: true } });
                if (!parent) throw AppError.badRequest('PARENT_PROJECT_NOT_FOUND');
                if (parent.opmcId !== opmcId) {
                    throw AppError.badRequest('PARENT_PROJECT_OPMC_MISMATCH');
                }
            }
            const selectedProjectType = await tx.projectType.findFirst({
                where: { id: projectTypeId, workflowTemplates: { some: { isActive: true } } },
                orderBy: { name: 'asc' },
            });

            if (!selectedProjectType) {
                throw AppError.badRequest(
                    'PROJECT_WORKFLOW_TEMPLATE_NOT_FOUND',
                );
            }

            const selectedCatalogEntry = getProjectTypeCatalogEntry(selectedProjectType.name);
            const effectivePlanningSource = requestedPlanningSource
                || selectedCatalogEntry?.defaultPlanningSource
                || 'CAD';

            const project = await tx.project.create({
                data: {
                    projectCode,
                    name,
                    // Preserve an explicitly supplied legacy type, but do not
                    // label CCTV/PABX/network projects as FTTH by default.
                    type: type || selectedProjectType.name,
                    contractorId: contractorId || null,
                    parentId: parentId || null,
                    planningSource: effectivePlanningSource,
                    opmcId: opmcId || null,
                    projectTypeId: selectedProjectType.id,
                    status: 'PLANNING'
                },
                include: {
                    opmc: true,
                    areaManager: true,
                    contractor: true,
                    projectType: {
                        select: { id: true, name: true, description: true }
                    },
                    parent: { select: { id: true, projectCode: true, name: true } },
                    contractorAssignments: {
                        include: { contractor: { select: { id: true, name: true } } },
                    }
                }
            });

            if (contractorId) {
                await tx.projectContractorAssignment.create({
                    data: { projectId: project.id, contractorId, role: 'PRIMARY' },
                });
            }

            // The same transaction covers project + workflow snapshot.  If initialization
            // fails, neither record is committed and the API returns an actionable error.
            await WorkflowEngine.initializeProjectWorkflow(
                project.id,
                selectedProjectType.id,
                tx as unknown as Prisma.TransactionClient,
            );
            return project;
        });
    }

    /**
     * Update project details
     */
    static async updateProject(id: string, updateData: UpdateProjectInput, actorUserId?: string | null) {
        const existingProject = await prisma.project.findUnique({
            where: { id },
            include: { workflowInstance: true }
        });

        if (!existingProject) {
            throw AppError.badRequest('PROJECT_NOT_FOUND');
        }

        const accessibleOpmcs = actorUserId === undefined ? undefined : await resolveOpmcScope(actorUserId);
        if (accessibleOpmcs !== undefined && (!existingProject.opmcId || !accessibleOpmcs.includes(existingProject.opmcId))) {
            throw AppError.forbidden('Project is outside the authenticated user scope');
        }
        if (accessibleOpmcs !== undefined && updateData.opmcId !== undefined
            && (!updateData.opmcId || !accessibleOpmcs.includes(updateData.opmcId))) {
            throw AppError.forbidden('Project OPMC is outside the authenticated user scope');
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
        if (updateData.parentId !== undefined) {
            const nextParentId = updateData.parentId || null;
            if (nextParentId === id) throw AppError.badRequest('PROJECT_CANNOT_PARENT_ITSELF');
            if (nextParentId) {
                const visited = new Set<string>();
                let cursor: string | null = nextParentId;
                while (cursor) {
                    if (cursor === id) throw AppError.badRequest('PROJECT_PARENT_CYCLE');
                    if (visited.has(cursor)) break;
                    visited.add(cursor);
                    const parent: { parentId: string | null; opmcId: string | null } | null = await prisma.project.findUnique({
                        where: { id: cursor },
                        select: { parentId: true, opmcId: true },
                    });
                    if (!parent) throw AppError.badRequest('PARENT_PROJECT_NOT_FOUND');
                    const nextOpmcId = updateData.opmcId !== undefined ? updateData.opmcId : existingProject.opmcId;
                    if (parent.opmcId !== nextOpmcId) throw AppError.badRequest('PARENT_PROJECT_OPMC_MISMATCH');
                    cursor = parent.parentId;
                }
            }
            finalUpdateData.parentId = nextParentId;
        }
        if (updateData.planningSource !== undefined) {
            const nextPlanningSource = updateData.planningSource?.trim().toUpperCase() || 'CAD';
            if (!['GIS', 'CAD', 'MANUAL'].includes(nextPlanningSource)) {
                throw AppError.badRequest('Planning source must be GIS, CAD, or MANUAL');
            }
            finalUpdateData.planningSource = nextPlanningSource;
        }

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
                    const { QFieldCloudSyncService } = await import('@/services/gis/qfieldcloud-sync.service');
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
    static async deleteProject(id: string) {
        // Verify project exists and get gisMapping
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
            throw AppError.badRequest('PROJECT_NOT_FOUND');
        }

        // Delete from QFieldCloud if mapped
        if (project.gisMapping) {
            const gisMapping = project.gisMapping as Record<string, unknown>;
            const qfieldProjectId = gisMapping?.qfieldProjectId as string;
            if (qfieldProjectId) {
                try {
                    const { QFieldCloudSyncService } = await import('@/services/gis/qfieldcloud-sync.service');
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

    /**
     * Check if project can be closed
     */
    static async checkClosure(projectId: string, actorUserId: string | null | undefined) {
        await assertProjectAccess(projectId, actorUserId);
        const [
            project,
            patSessions,
            invoices,
            openChangeRequests,
            pendingTasks,
            pendingReturns,
            workflow,
        ] = await Promise.all([
            prisma.project.findUnique({
                where: { id: projectId },
                select: { id: true, name: true, status: true, budget: true, actualCost: true },
            }),
            prisma.pATSession.count({
                where: { projectId, status: { notIn: ['COMPLETED'] } },
            }),
            prisma.projectInvoice.findMany({
                where: { projectId },
                select: { type: true, status: true, submissionStatus: true, paymentStatus: true, totalAmount: true, paidAmount: true, balanceAmount: true },
            }),
            prisma.projectChangeRequest.count({
                where: { projectId, status: { in: ['DRAFT', 'SUBMITTED'] } },
            }),
            prisma.projectTask.count({
                where: { projectId, status: { not: 'COMPLETED' } },
            }),
            prisma.projectMaterialReturn.count({
                where: { projectId, status: 'PENDING' },
            }),
            prisma.projectWorkflowInstance.findUnique({
                where: { projectId },
                select: { stages: { select: { code: true, name: true, sequence: true, status: true } } },
            }),
        ]);
        const unpaidInvoices = invoices.filter(isInvoiceOpenForClosure).length;
        const incompleteStages = workflow ? getIncompleteClosureStages(workflow.stages) : ['Workflow is missing'];

        const checks = [
            {
                check: 'Workflow Stages Complete',
                passed: incompleteStages.length === 0,
                detail: incompleteStages.length > 0 ? `Incomplete: ${incompleteStages.join(', ')}` : 'Delivery stages complete',
            },
            {
                check: 'PAT Complete',
                passed: patSessions === 0,
                detail: patSessions > 0 ? `${patSessions} PAT sessions pending` : 'All PAT complete',
            },
            {
                check: 'Invoices Paid',
                passed: unpaidInvoices === 0,
                detail: unpaidInvoices > 0 ? `${unpaidInvoices} unpaid invoices` : 'All invoices paid',
            },
            {
                check: 'Change Requests Closed',
                passed: openChangeRequests === 0,
                detail: openChangeRequests > 0 ? `${openChangeRequests} open change requests` : 'No open CRs',
            },
            {
                check: 'Tasks Complete',
                passed: pendingTasks === 0,
                detail: pendingTasks > 0 ? `${pendingTasks} pending tasks` : 'All tasks complete',
            },
            {
                check: 'Returns Closed',
                passed: pendingReturns === 0,
                detail: pendingReturns > 0 ? `${pendingReturns} pending returns` : 'All returns resolved',
            },
        ];

        const allPassed = checks.every((c) => c.passed);

        return {
            project: { id: project?.id, name: project?.name, status: project?.status },
            canClose: allPassed,
            checks,
            financial: {
                budget: project?.budget,
                actualCost: project?.actualCost,
                variance: project?.budget && project?.actualCost
                    ? Number(project.budget) - Number(project.actualCost)
                    : null,
            },
        };
    }

    /**
     * Close the project
     */
    static async closeProject(projectId: string, userId: string, remarks?: string, finalAsBuiltGenerated?: boolean) {
        await assertProjectAccess(projectId, userId);
        if (finalAsBuiltGenerated === false) throw AppError.badRequest('Final as-built generation is required');
        const readiness = await this.checkClosure(projectId, userId);
        if (!readiness.canClose) throw AppError.badRequest('PROJECT_CLOSURE_CHECKS_FAILED');
        const { AsBuiltService } = await import('@/services/project/as-built.service');
        await AsBuiltService.generateQGIS(projectId);
        const project = await prisma.$transaction(async (tx) => {
            const current = await tx.project.findUnique({ where: { id: projectId }, select: { status: true } });
            if (!current) throw AppError.notFound('Project not found');
            if (current.status === 'COMPLETED') throw AppError.badRequest('PROJECT_ALREADY_CLOSED');
            const [patPending, invoices, openChangeRequests, pendingTasks, pendingReturns, workflow] = await Promise.all([
                tx.pATSession.count({ where: { projectId, status: { notIn: ['COMPLETED'] } } }),
                tx.projectInvoice.findMany({
                    where: { projectId },
                    select: { type: true, status: true, submissionStatus: true, paymentStatus: true, totalAmount: true, paidAmount: true, balanceAmount: true },
                }),
                tx.projectChangeRequest.count({ where: { projectId, status: { in: ['DRAFT', 'SUBMITTED'] } } }),
                tx.projectTask.count({ where: { projectId, status: { not: 'COMPLETED' } } }),
                tx.projectMaterialReturn.count({ where: { projectId, status: 'PENDING' } }),
                tx.projectWorkflowInstance.findUnique({
                    where: { projectId },
                    select: { stages: { select: { code: true, name: true, sequence: true, status: true } } },
                }),
            ]);
            const unpaidInvoices = invoices.filter(isInvoiceOpenForClosure).length;
            const incompleteStages = workflow ? getIncompleteClosureStages(workflow.stages) : ['Workflow is missing'];
            const totalOpen = patPending + unpaidInvoices + openChangeRequests + pendingTasks + pendingReturns + incompleteStages.length;
            if (totalOpen > 0) {
                const error = new Error(`Cannot close: ${totalOpen} open items remain`) as Error & { code?: string; openIssues?: Record<string, number> };
                error.code = 'OPEN_ISSUES_REMAIN';
                error.openIssues = { patPending, unpaidInvoices, openChangeRequests, pendingTasks, pendingReturns, incompleteStages: incompleteStages.length };
                throw error;
            }

            const updated = await tx.project.update({
                where: { id: projectId },
                data: { status: 'COMPLETED' },
            });
            await tx.gISAuditLog.create({
                data: {
                    projectId,
                    entityType: 'PROJECT',
                    entityId: projectId,
                    action: 'CLOSED',
                    performedById: userId,
                    fieldChanges: { remarks, closedAt: new Date().toISOString() },
                    source: 'PROJECT_CLOSURE',
                },
            });
            return updated;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        // Calculate final KPI for contractor
        if (project.contractorId) {
            try {
                const { ContractorKPIService } = await import('@/services/contractor/contractor-kpi.service');
                await ContractorKPIService.calculateMonthlyScore(
                    project.contractorId,
                    new Date().toISOString().substring(0, 7),
                    projectId
                );
            } catch (e) {
                console.warn('Final KPI calculation skipped:', e);
            }
        }

        return {
            message: 'Project closed successfully',
            project: { id: project.id, name: project.name, status: 'COMPLETED' },
            closedAt: new Date(),
        };
    }
}
