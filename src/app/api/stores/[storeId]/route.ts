import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get single store
export async function GET(
    request: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const store = await prisma.inventoryStore.findUnique({
            where: { id: params.storeId },
            include: {
                opmcs: true,
                manager: true
            }
        });

        if (!store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        return NextResponse.json(store);
    } catch (error) {
        console.error('Error fetching store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update store
export async function PUT(
    request: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const { name, type, location, managerId, opmcIds } = await request.json();

        // Update store
        const store = await prisma.inventoryStore.update({
            where: { id: params.storeId },
            data: {
                name,
                type,
                location,
                managerId: managerId || null
            }
        });

        // Update OPMC assignments
        // First, remove all current assignments
        await prisma.oPMC.updateMany({
            where: { storeId: params.storeId },
            data: { storeId: null }
        });

        // Then assign new OPMCs
        if (opmcIds && opmcIds.length > 0) {
            await prisma.oPMC.updateMany({
                where: { id: { in: opmcIds } },
                data: { storeId: params.storeId }
            });
        }

        return NextResponse.json(store);
    } catch (error) {
        console.error('Error updating store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete store
export async function DELETE(
    request: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        // Remove OPMC assignments first
        await prisma.oPMC.updateMany({
            where: { storeId: params.storeId },
            data: { storeId: null }
        });

        // Delete store
        await prisma.inventoryStore.delete({
            where: { id: params.storeId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
