import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

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
                },
                sods: {
                    select: {
                        id: true,
                        serviceId: true,
                        status: true
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
