import { NextResponse } from 'next/server';
import { ProjectBOQService } from '@/services/project-boq.service';

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

        const boqItems = await ProjectBOQService.getBOQItems(projectId);
        return NextResponse.json(boqItems);
    } catch (error: unknown) {
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
            unitRate
        } = body;

        if (!projectId || !itemCode || !description || !unit || quantity === undefined || unitRate === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const boqItem = await ProjectBOQService.createBOQItem(body);
        return NextResponse.json(boqItem);
    } catch (error: unknown) {
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
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'BOQ item ID required' },
                { status: 400 }
            );
        }

        const boqItem = await ProjectBOQService.updateBOQItem(id, updateData);
        return NextResponse.json(boqItem);
    } catch (error: unknown) {
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

        await ProjectBOQService.deleteBOQItem(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting BOQ item:', error);
        return NextResponse.json(
            { error: 'Failed to delete BOQ item' },
            { status: 500 }
        );
    }
}
