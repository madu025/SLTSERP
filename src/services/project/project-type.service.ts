import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import {
    GENERIC_WORKFLOW_STAGES,
    getProjectTypeCatalogEntry,
    normalizeProjectTypeName,
} from '@/config/project-type-catalog';

export class ProjectTypeService {
    static async getProjectTypes() {
        const projectTypes = await prisma.projectType.findMany({
            // The project creation selector must never offer a type that cannot
            // initialize a workflow. Admins can still create new types, but they
            // become selectable only after an active template is configured.
            where: { workflowTemplates: { some: { isActive: true } } },
            include: {
                _count: {
                    select: { projects: true, workflowTemplates: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return projectTypes.map((projectType) => {
            const catalogEntry = getProjectTypeCatalogEntry(projectType.name);
            return {
                ...projectType,
                defaultPlanningSource: catalogEntry?.defaultPlanningSource ?? 'CAD',
                roleSummary: catalogEntry?.roleSummary ?? ['MANAGER', 'ENGINEER', 'QC_OFFICER'],
            };
        });
    }

    static async createProjectType(name: string, description?: string) {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw AppError.badRequest('Project type name is required');
        }

        const normalizedName = normalizeProjectTypeName(name);
        if (normalizedName.length < 2 || normalizedName.length > 80) {
            throw AppError.badRequest('Project type name must be between 2 and 80 characters');
        }

        const existing = await prisma.projectType.findUnique({
            where: { name: normalizedName }
        });

        if (existing) {
            throw AppError.conflict('A project type with this name already exists');
        }

        const catalogEntry = getProjectTypeCatalogEntry(normalizedName);
        const workflowName = catalogEntry?.workflowName ?? `${normalizedName} Workflow`;
        const workflowDescription = catalogEntry?.workflowDescription ?? `Reusable project workflow for ${normalizedName.replace(/_/g, ' ').toLowerCase()} delivery`;

        return await prisma.$transaction(async (tx) => {
            const projectType = await tx.projectType.create({
                data: {
                    name: normalizedName,
                    description: description?.trim() || `Project type for ${normalizedName.replace(/_/g, ' ').toLowerCase()}`,
                },
            });

            await tx.workflowTemplate.create({
                data: {
                    name: workflowName,
                    description: workflowDescription,
                    projectTypeId: projectType.id,
                    stages: {
                        create: GENERIC_WORKFLOW_STAGES.map((stage, index) => ({
                            code: stage.code,
                            name: stage.name,
                            description: stage.description,
                            sequence: index + 1,
                            workstream: stage.workstream,
                            assignmentRole: stage.assignmentRole,
                            assignmentTeamKey: stage.assignmentTeamKey,
                            reqApproval: stage.reqApproval ?? false,
                            reqChecklist: stage.reqChecklist ?? false,
                            reqPhotos: stage.reqPhotos ?? false,
                            reqMaterials: stage.reqMaterials ?? false,
                            reqDocuments: stage.reqDocuments ?? false,
                            approvalTemplates: {
                                create: (stage.approvalRoles ?? []).map((role, level) => ({ level: level + 1, role })),
                            },
                            checklistTemplates: {
                                create: (stage.checklistLabels ?? []).map((label) => ({
                                    label,
                                    isMandatory: true,
                                    reqPhoto: stage.reqPhotos ?? false,
                                })),
                            },
                            taskTemplates: {
                                create: stage.tasks.map((task) => ({
                                    code: task.code,
                                    name: task.name,
                                    priority: 'MEDIUM',
                                    taskType: task.taskType ?? 'SEMI_TASK',
                                    assignmentRole: task.assignmentRole,
                                    assignmentTeamKey: task.assignmentTeamKey,
                                    isRequired: true,
                                    isSupervisorSelectable: true,
                                    dependsOnCode: task.dependsOnCode,
                                })),
                            },
                        })),
                    },
                },
            });

            return {
                ...projectType,
                defaultPlanningSource: catalogEntry?.defaultPlanningSource ?? 'CAD',
                roleSummary: catalogEntry?.roleSummary ?? ['MANAGER', 'ENGINEER', 'QC_OFFICER'],
            };
        });
    }
}
