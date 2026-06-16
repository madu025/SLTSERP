import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        let workflowInstance = await prisma.projectWorkflowInstance.findUnique({
            where: { projectId: id },
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
        });

        // Auto-initialize with a default template if none exists and the project has a type
        if (!workflowInstance) {
            const project = await prisma.project.findUnique({
                where: { id },
                select: { projectTypeId: true, type: true },
            });

            if (project) {
                let projectTypeId = project.projectTypeId;

                // Fallback: Find first project type if not explicitly set
                if (!projectTypeId) {
                    const firstType = await prisma.projectType.findFirst();
                    if (firstType) {
                        projectTypeId = firstType.id;
                        // update project
                        await prisma.project.update({
                            where: { id },
                            data: { projectTypeId },
                        });
                    }
                }

                if (projectTypeId) {
                    await WorkflowEngine.initializeProjectWorkflow(id, projectTypeId);
                    workflowInstance = await prisma.projectWorkflowInstance.findUnique({
                        where: { projectId: id },
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
                    });
                }
            }
        }

        if (!workflowInstance) {
            return NextResponse.json({ error: 'No active workflow found and could not auto-initialize' }, { status: 404 });
        }

        return NextResponse.json(workflowInstance);
    } catch (error: any) {
        console.error('Error fetching project workflow:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch project workflow' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { projectTypeId } = await request.json();

        if (!projectTypeId) {
            return NextResponse.json({ error: 'projectTypeId is required' }, { status: 400 });
        }

        const existing = await prisma.projectWorkflowInstance.findUnique({
            where: { projectId: id }
        });

        if (existing) {
            return NextResponse.json({ error: 'Workflow already initialized for this project' }, { status: 400 });
        }

        const workflowInstance = await WorkflowEngine.initializeProjectWorkflow(id, projectTypeId);
        return NextResponse.json({ success: true, workflowInstance });
    } catch (error: any) {
        console.error('Error initializing workflow:', error);
        return NextResponse.json({ error: error.message || 'Failed to initialize workflow' }, { status: 500 });
    }
}
