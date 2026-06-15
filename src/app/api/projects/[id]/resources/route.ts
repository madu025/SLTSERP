import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch allocated resources and metadata of potential assignees
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // 1. Fetch resources currently allocated to this project
        const allocated = await prisma.projectResource.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Fetch available Staff
        const staff = await prisma.staff.findMany({
            select: { id: true, name: true, designation: true }
        });

        // 3. Fetch available Contractor Teams
        const teams = await prisma.contractorTeam.findMany({
            select: { id: true, name: true, contractor: { select: { name: true } } }
        });

        return NextResponse.json({
            allocated,
            available: {
                staff: staff.map(s => ({ id: s.id, name: `${s.name} (${s.designation})`, type: 'STAFF' })),
                teams: teams.map(t => ({ id: t.id, name: `${t.name} - ${t.contractor.name}`, type: 'TEAM' }))
            }
        });
    } catch (error) {
        console.error('Error fetching project resources:', error);
        return NextResponse.json({ error: 'Failed to fetch project resources' }, { status: 500 });
    }
}

// POST: Allocate a resource
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { resourceType, resourceId, name, role, allocationPercentage, startDate, endDate } = body;

        if (!resourceType || !resourceId || !name || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify overlapping loading percentage
        const overlaps = await prisma.projectResource.findMany({
            where: {
                resourceId,
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(startDate) }
            }
        });

        const currentAllocationSum = overlaps.reduce((sum, r) => sum + r.allocationPercentage, 0);
        const newTotal = currentAllocationSum + Number(allocationPercentage || 100);

        // Warning flag
        const isOverloaded = newTotal > 100;

        const newResource = await prisma.projectResource.create({
            data: {
                projectId,
                resourceType,
                resourceId,
                name,
                role: role || null,
                allocationPercentage: Number(allocationPercentage || 100),
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            }
        });

        return NextResponse.json({
            resource: newResource,
            warning: isOverloaded ? `Warning: Resource total loading will be ${newTotal}% during this period.` : null
        });
    } catch (error) {
        console.error('Error allocating project resource:', error);
        return NextResponse.json({ error: 'Failed to allocate resource' }, { status: 500 });
    }
}

// DELETE: Remove a resource allocation
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        const resourceAllocationId = searchParams.get('id');

        if (!resourceAllocationId) {
            return NextResponse.json({ error: 'Allocation ID is required' }, { status: 400 });
        }

        await prisma.projectResource.delete({
            where: { id: resourceAllocationId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing allocated resource:', error);
        return NextResponse.json({ error: 'Failed to remove resource' }, { status: 500 });
    }
}
