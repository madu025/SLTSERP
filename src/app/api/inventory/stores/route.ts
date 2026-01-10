import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const stores = await prisma.inventoryStore.findMany({
            include: {
                manager: {
                    select: { name: true, username: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        return NextResponse.json(stores);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, type, location, managerId } = body;

        const store = await prisma.inventoryStore.create({
            data: {
                name,
                type,
                location,
                managerId: managerId === 'none' ? null : managerId
            }
        });

        return NextResponse.json(store);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, type, location, managerId } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const store = await prisma.inventoryStore.update({
            where: { id },
            data: {
                name,
                type,
                location,
                managerId: managerId === 'none' ? null : managerId
            }
        });

        return NextResponse.json(store);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Check for dependencies before delete
        const hasStock = await prisma.inventoryStock.findFirst({ where: { storeId: id, quantity: { gt: 0 } } });
        if (hasStock) return NextResponse.json({ error: 'Cannot delete store with active stock.' }, { status: 400 });

        const hasTx = await prisma.inventoryTransaction.findFirst({ where: { storeId: id } });
        if (hasTx) return NextResponse.json({ error: 'Cannot delete store with transaction history.' }, { status: 400 });

        await prisma.inventoryStore.delete({ where: { id } });

        return NextResponse.json({ message: 'Store deleted' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
    }
}
