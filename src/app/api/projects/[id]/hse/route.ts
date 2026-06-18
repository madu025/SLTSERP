import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all HSE records for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const [safetyLogs, toolboxTalks] = await Promise.all([
            prisma.hSESafetyLog.findMany({
                where: { projectId },
                include: { attendees: true },
                orderBy: { logDate: 'desc' }
            }),
            prisma.hSEAttendee.findMany({
                where: { safetyLog: { projectId } },
                orderBy: { attendedAt: 'desc' },
                take: 100
            })
        ]);

        return NextResponse.json({ safetyLogs, toolboxTalks });
    } catch (error) {
        console.error('Error fetching HSE data:', error);
        return NextResponse.json({ error: 'Failed to fetch HSE data' }, { status: 500 });
    }
}

// POST: Log a new HSE safety entry
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { logType, description, severity, location, latitude, longitude, reportedById, attendees } = body;

        if (!logType || !description || !reportedById) {
            return NextResponse.json({ error: 'Missing required fields: logType, description, reportedById' }, { status: 400 });
        }

        const safetyLog = await prisma.hSESafetyLog.create({
            data: {
                projectId,
                logType,
                description,
                severity: severity || 'LOW',
                location: location || null,
                latitude: latitude || null,
                longitude: longitude || null,
                reportedById,
                attendees: attendees?.length ? {
                    create: attendees.map((a: { userId: string; role?: string }) => ({
                        userId: a.userId,
                        role: a.role || 'ATTENDEE',
                        attendedAt: new Date()
                    }))
                } : undefined
            },
            include: { attendees: true }
        });

        return NextResponse.json(safetyLog, { status: 201 });
    } catch (error) {
        console.error('Error logging HSE entry:', error);
        return NextResponse.json({ error: 'Failed to log HSE entry' }, { status: 500 });
    }
}

// PATCH: Update HSE log status or resolution
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { logId, status, resolution, resolvedById } = body;

        if (!logId) {
            return NextResponse.json({ error: 'Log ID is required' }, { status: 400 });
        }

        const updated = await prisma.hSESafetyLog.update({
            where: { id: logId },
            data: {
                status: status ?? undefined,
                resolution: resolution ?? undefined,
                resolvedById: resolvedById ?? undefined,
                resolvedAt: status === 'CLOSED' ? new Date() : undefined
            },
            include: { attendees: true }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating HSE log:', error);
        return NextResponse.json({ error: 'Failed to update HSE log' }, { status: 500 });
    }
}