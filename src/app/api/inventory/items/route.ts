import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const items = await prisma.inventoryItem.findMany({
            orderBy: { code: 'asc' }
        });
        return NextResponse.json(items);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, name, description, unit, type, category, minLevel } = body;

        // Basic Validation
        if (!code || !name) {
            return NextResponse.json({ error: 'Code and Name are required' }, { status: 400 });
        }

        const item = await prisma.inventoryItem.create({
            data: {
                code,
                name,
                description,
                unit: unit || 'Nos',
                type: type || 'SLTS',
                category: category || 'OTHERS',
                minLevel: minLevel ? parseFloat(minLevel) : 0
            }
        });

        return NextResponse.json(item);
    } catch (error: any) {
        if (error.code === 'P2002') { // Prisma unique constraint error
            return NextResponse.json({ error: 'Item code already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, description, unit, type, category, minLevel } = body;

        const item = await prisma.inventoryItem.update({
            where: { id },
            data: {
                name,
                description,
                unit,
                type,
                category,
                minLevel: minLevel ? parseFloat(minLevel) : 0
            }
        });
        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Check usage
        const hasStock = await prisma.inventoryStock.findFirst({ where: { itemId: id, quantity: { gt: 0 } } });
        if (hasStock) return NextResponse.json({ error: 'Cannot delete item with existing stock.' }, { status: 400 });

        await prisma.inventoryItem.delete({ where: { id } });

        return NextResponse.json({ message: 'Item deleted' });
    } catch (error) {
        // Foreign key constraint failures will allow us to catch used items
        return NextResponse.json({ error: 'Failed to delete item. It may be used in transactions.' }, { status: 500 });
    }
}
