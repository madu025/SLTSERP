import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all OPMCs
export async function GET() {
    try {
        const opmcs = await prisma.oPMC.findMany({
            include: {
                _count: {
                    select: {
                        staff: true,
                        projects: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(opmcs);
    } catch (error) {
        return NextResponse.json({ message: 'Error fetching OPMCs' }, { status: 500 });
    }
}

// POST new OPMC
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, rtom, region, province } = body;

        const opmc = await prisma.oPMC.create({
            data: { name, rtom, region, province }
        });

        return NextResponse.json(opmc);
    } catch (error) {
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ message: 'OPMC RTOM already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating OPMC' }, { status: 500 });
    }
}

// PUT update OPMC
export async function PUT(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { id, name, rtom, region, province } = body;

        if (!id) {
            return NextResponse.json({ message: 'OPMC ID required' }, { status: 400 });
        }

        const opmc = await prisma.oPMC.update({
            where: { id },
            data: { name, rtom, region, province }
        });

        return NextResponse.json(opmc);
    } catch (error) {
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ message: 'OPMC RTOM already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error updating OPMC' }, { status: 500 });
    }
}

// DELETE OPMC
export async function DELETE(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Only Super Admin can delete OPMCs' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ message: 'OPMC ID required' }, { status: 400 });
        }

        // Check if OPMC has associated staff or projects
        const opmc = await prisma.oPMC.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        staff: true,
                        projects: true
                    }
                }
            }
        });

        if (!opmc) {
            return NextResponse.json({ message: 'OPMC not found' }, { status: 404 });
        }

        if (opmc._count.staff > 0 || opmc._count.projects > 0) {
            return NextResponse.json({
                message: `Cannot delete OPMC. It has ${opmc._count.staff} staff members and ${opmc._count.projects} projects associated.`
            }, { status: 400 });
        }

        await prisma.oPMC.delete({ where: { id } });
        return NextResponse.json({ message: 'OPMC deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting OPMC' }, { status: 500 });
    }
}
