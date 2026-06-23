import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { calculateProjectProgress } from '@/lib/project-progress';

// GET all projects
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const opmcId = searchParams.get('opmcId');
        const contractorId = searchParams.get('contractorId');
        const projectTypeId = searchParams.get('projectTypeId');
        const search = searchParams.get('search') || searchParams.get('q') || '';

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const skip = (page - 1) * limit;

        const where: any = {};

        if (status && status !== 'ALL') where.status = status;
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

        const isPaginated = searchParams.has('page') || searchParams.has('limit');

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
            return NextResponse.json({
                projects,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        }

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects' },
            { status: 500 }
        );
    }
}

// POST create new project
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            projectCode,
            name,
            type,
            contractorId,
            opmcId,
            projectTypeId
        } = body;

        // Validate required fields
        if (!projectCode || !name) {
            return NextResponse.json(
                { error: 'Project code and name are required' },
                { status: 400 }
            );
        }

        // Check if project code already exists
        const existing = await prisma.project.findUnique({
            where: { projectCode }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Project code already exists' },
                { status: 400 }
            );
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

        return NextResponse.json(project);
    } catch (error: unknown) {
        console.error('Error creating project:', error);
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            return NextResponse.json(
                { error: 'Project code already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}

// PATCH update project
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID required' },
                { status: 400 }
            );
        }

        const existingProject = await prisma.project.findUnique({
            where: { id },
            include: { workflowInstance: true }
        });

        if (!existingProject) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const hasActiveWorkflow = !!existingProject.workflowInstance;

        // Process date and numeric fields (use !== undefined to allow 0/falsy values)
        if (updateData.startDate !== undefined && updateData.startDate !== null) updateData.startDate = new Date(updateData.startDate);
        if (updateData.endDate !== undefined && updateData.endDate !== null) updateData.endDate = new Date(updateData.endDate);
        if (updateData.budget !== undefined && updateData.budget !== null) updateData.budget = parseFloat(updateData.budget);
        if (updateData.actualCost !== undefined && updateData.actualCost !== null) updateData.actualCost = parseFloat(updateData.actualCost);
        
        if (updateData.progress !== undefined && updateData.progress !== null) {
            if (hasActiveWorkflow) {
                console.warn(`Blocking manual progress write of ${updateData.progress}% for project ${id} because it has an active workflow.`);
                delete updateData.progress;
            } else {
                updateData.progress = parseFloat(updateData.progress);
            }
        }
        
        if (updateData.status !== undefined && updateData.status !== null) {
            if (hasActiveWorkflow) {
                console.warn(`Blocking manual status write of ${updateData.status} for project ${id} because it has an active workflow.`);
                delete updateData.status;
            }
        }

        if (updateData.estimatedDuration !== undefined && updateData.estimatedDuration !== null) updateData.estimatedDuration = parseInt(updateData.estimatedDuration);
        if (updateData.actualDuration !== undefined && updateData.actualDuration !== null) updateData.actualDuration = parseInt(updateData.actualDuration);
        // Handle location, description etc.
        if (updateData.location !== undefined) updateData.location = updateData.location || null;
        if (updateData.description !== undefined) updateData.description = updateData.description || null;
        if (updateData.opmcId !== undefined) updateData.opmcId = updateData.opmcId || null;
        if (updateData.contractorId !== undefined) updateData.contractorId = updateData.contractorId || null;
        if (updateData.areaManagerId !== undefined) updateData.areaManagerId = updateData.areaManagerId || null;

        const project = await prisma.project.update({
            where: { id },
            data: updateData,
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

        return NextResponse.json(finalProject);
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json(
            { error: 'Failed to update project' },
            { status: 500 }
        );
    }
}

// DELETE project
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID required' },
                { status: 400 }
            );
        }

        // Verify project exists and get gisMapping
        const project = await prisma.project.findUnique({ where: { id } });
        if (project && project.gisMapping) {
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
