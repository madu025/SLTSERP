import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkflowEngine } from '@/services/WorkflowEngine';

// GET all projects
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const opmcId = searchParams.get('opmcId');
        const projectTypeId = searchParams.get('projectTypeId');

        const where: any = {};

        if (status) where.status = status;
        if (type) where.type = type;
        if (opmcId) where.opmcId = opmcId;
        if (projectTypeId) where.projectTypeId = projectTypeId;

        const projects = await prisma.project.findMany({
            where,
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
        });

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
            description,
            type,
            location,
            budget,
            startDate,
            endDate,
            estimatedDuration,
            areaManagerId,
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
                description: description || null,
                type: type || 'FTTH',
                location: location || null,
                budget: budget ? parseFloat(budget) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : null,
                areaManagerId: areaManagerId || null,
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
    } catch (error: any) {
        console.error('Error creating project:', error);
        if (error.code === 'P2002') {
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

        // Process date and numeric fields (use !== undefined to allow 0/falsy values)
        if (updateData.startDate !== undefined && updateData.startDate !== null) updateData.startDate = new Date(updateData.startDate);
        if (updateData.endDate !== undefined && updateData.endDate !== null) updateData.endDate = new Date(updateData.endDate);
        if (updateData.budget !== undefined && updateData.budget !== null) updateData.budget = parseFloat(updateData.budget);
        if (updateData.actualCost !== undefined && updateData.actualCost !== null) updateData.actualCost = parseFloat(updateData.actualCost);
        if (updateData.progress !== undefined && updateData.progress !== null) updateData.progress = parseFloat(updateData.progress);
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

        return NextResponse.json(project);
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
