import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all HSE records for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const safetyLogs = await prisma.hSESafetyLog.findMany({
            where: { projectId },
            include: { attendees: true },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json({ safetyLogs });
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
        const { logType, title, description, severity, location, recordedById, attendees } = body;

        if (!logType || !title || !recordedById) {
            return NextResponse.json({ error: 'Missing required fields: logType, title, recordedById' }, { status: 400 });
        }

        const safetyLog = await prisma.hSESafetyLog.create({
            data: {
                projectId,
                logType,
                title,
                description: description || null,
                severity: severity || null,
                location: location || null,
                recordedById,
                attendees: attendees?.length ? {
                    create: attendees.map((a: { name: string; designation?: string; signatureUrl?: string }) => ({
                        name: a.name,
                        designation: a.designation || null,
                        signatureUrl: a.signatureUrl || null,
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
        const { logId, status, correctiveAction, closedById } = body;

        if (!logId) {
            return NextResponse.json({ error: 'Log ID is required' }, { status: 400 });
        }

        const updated = await prisma.hSESafetyLog.update({
            where: { id: logId },
            data: {
                status: status ?? undefined,
                correctiveAction: correctiveAction ?? undefined,
                closedById: closedById ?? undefined,
                closedAt: status === 'CLOSED' ? new Date() : undefined
            },
            include: { attendees: true }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating HSE log:', error);
        return NextResponse.json({ error: 'Failed to update HSE log' }, { status: 500 });
    }
}