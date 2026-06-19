import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error('Error fetching project details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch project details' },
            { status: 500 }
        );
    }
}

// DELETE project - Admin/Super Admin only
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userRole = request.headers.get('x-user-role');
        if (!userRole || !['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
            return NextResponse.json(
                { error: 'Unauthorized: Only Admin or Super Admin can delete projects' },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Verify project exists before deleting
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
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
                    // Do not block local deletion if QFieldCloud server is offline or fails
                }
            }
        }

        await prisma.project.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
