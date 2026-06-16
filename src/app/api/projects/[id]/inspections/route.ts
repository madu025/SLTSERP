import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch QA check sheets and inspection reports
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const inspections = await prisma.projectInspection.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(inspections);
    } catch (error) {
        console.error('Error fetching QA inspections:', error);
        return NextResponse.json({ error: 'Failed to fetch inspections' }, { status: 500 });
    }
}

// POST: Add new inspection list or NCR log
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, category, checklist, inspectorId } = body;

        if (!title || !category || !checklist || !inspectorId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const newInspection = await prisma.projectInspection.create({
            data: {
                projectId,
                title,
                category, // INSPECTION_REQUEST or NON_CONFORMANCE
                checklist: checklist, // JSON array of verification checks
                inspectorId,
                status: 'PENDING'
            }
        });

        return NextResponse.json(newInspection);
    } catch (error) {
        console.error('Error logging inspection request:', error);
        return NextResponse.json({ error: 'Failed to submit inspection request' }, { status: 500 });
    }
}

// PATCH: Quality checklist checks, sign-off status or corrective actions
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { inspectionId, status, checklist, correctiveAction, photoUrls } = body;

        if (!inspectionId) {
            return NextResponse.json({ error: 'Inspection ID is required' }, { status: 400 });
        }

        const updatedInspection = await prisma.projectInspection.update({
            where: { id: inspectionId },
            data: {
                status: status !== undefined ? status : undefined,
                checklist: checklist !== undefined ? checklist : undefined,
                correctiveAction: correctiveAction !== undefined ? correctiveAction : undefined,
                photoUrls: photoUrls !== undefined ? photoUrls : undefined,
                inspectedAt: status !== undefined ? new Date() : undefined
            }
        });

        return NextResponse.json(updatedInspection);
    } catch (error) {
        console.error('Error updating QA inspection:', error);
        return NextResponse.json({ error: 'Failed to update inspection' }, { status: 500 });
    }
}
