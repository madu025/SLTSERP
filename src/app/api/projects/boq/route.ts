import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET list BOQ items for a project
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId query parameter is required' },
                { status: 400 }
            );
        }

        const boqItems = await prisma.projectBOQItem.findMany({
            where: { projectId },
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
            orderBy: { itemCode: 'asc' }
        });

        return NextResponse.json(boqItems);
    } catch (error) {
        console.error('Error fetching BOQ items:', error);
        return NextResponse.json(
            { error: 'Failed to fetch BOQ items' },
            { status: 500 }
        );
    }
}

// POST create BOQ item
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            projectId,
            itemCode,
            description,
            unit,
            quantity,
            unitRate,
            category,
            materialId,
            remarks
        } = body;

        if (!projectId || !itemCode || !description || !unit || !quantity || !unitRate) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const amount = parseFloat(quantity) * parseFloat(unitRate);

        const boqItem = await prisma.projectBOQItem.create({
            data: {
                projectId,
                itemCode,
                description,
                unit,
                quantity: parseFloat(quantity),
                unitRate: parseFloat(unitRate),
                amount,
                category: category || null,
                materialId: materialId || null,
                remarks: remarks || null
            },
            include: {
                material: true
            }
        });

        return NextResponse.json(boqItem);
    } catch (error) {
        console.error('Error creating BOQ item:', error);
        return NextResponse.json(
            { error: 'Failed to create BOQ item' },
            { status: 500 }
        );
    }
}

// PATCH update BOQ item
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, quantity, unitRate, actualQuantity, actualCost, ...other } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'BOQ item ID required' },
                { status: 400 }
            );
        }

        const updateData: any = { ...other };

        if (quantity !== undefined) {
            updateData.quantity = parseFloat(quantity);
            updateData.unitRate = unitRate !== undefined ? parseFloat(unitRate) : undefined;
            if (updateData.quantity && updateData.unitRate) {
                updateData.amount = updateData.quantity * updateData.unitRate;
            }
        }

        if (actualQuantity !== undefined) updateData.actualQuantity = parseFloat(actualQuantity);
        if (actualCost !== undefined) updateData.actualCost = parseFloat(actualCost);

        const boqItem = await prisma.projectBOQItem.update({
            where: { id },
            data: updateData,
            include: {
                material: true
            }
        });

        return NextResponse.json(boqItem);
    } catch (error) {
        console.error('Error updating BOQ item:', error);
        return NextResponse.json(
            { error: 'Failed to update BOQ item' },
            { status: 500 }
        );
    }
}

// DELETE BOQ item
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'BOQ item ID required' },
                { status: 400 }
            );
        }

        await prisma.projectBOQItem.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting BOQ item:', error);
        return NextResponse.json(
            { error: 'Failed to delete BOQ item' },
            { status: 500 }
        );
    }
}
