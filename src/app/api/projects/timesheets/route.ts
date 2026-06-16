import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/timesheets?projectId=xxx&taskId=xxx&date=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const taskId = searchParams.get('taskId');
        const date = searchParams.get('date');

        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (taskId) where.taskId = taskId;
        if (date) {
            const d = new Date(date);
            where.date = {
                gte: new Date(d.setHours(0, 0, 0, 0)),
                lte: new Date(d.setHours(23, 59, 59, 999))
            };
        }

        const timesheets = await prisma.timesheet.findMany({
            where,
            include: {
                task: { select: { id: true, name: true, wbsCode: true } }
            },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(timesheets);
    } catch (error) {
        console.error('Error fetching timesheets:', error);
        return NextResponse.json({ error: 'Failed to fetch timesheets' }, { status: 500 });
    }
}

// POST /api/projects/timesheets
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, taskId, staffId, contractorId, date, hours, description } = body;

        if (!projectId || !taskId || !hours) {
            return NextResponse.json({ error: 'projectId, taskId, and hours are required' }, { status: 400 });
        }

        if (hours <= 0 || hours > 24) {
            return NextResponse.json({ error: 'Hours must be between 0 and 24' }, { status: 400 });
        }

        const timesheet = await prisma.timesheet.create({
            data: {
                projectId,
                taskId,
                staffId,
                contractorId,
                date: date ? new Date(date) : new Date(),
                hours: parseFloat(hours),
                description,
                status: 'PENDING'
            },
            include: {
                task: { select: { id: true, name: true, wbsCode: true } }
            }
        });

        return NextResponse.json(timesheet, { status: 201 });
    } catch (error) {
        console.error('Error creating timesheet:', error);
        return NextResponse.json({ error: 'Failed to create timesheet' }, { status: 500 });
    }
}

// PATCH /api/projects/timesheets (for verification)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, verifiedById } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const timesheet = await prisma.timesheet.update({
            where: { id },
            data: {
                status,
                verifiedById: verifiedById || undefined,
                verifiedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : undefined
            }
        });

        return NextResponse.json(timesheet);
    } catch (error) {
        console.error('Error updating timesheet:', error);
        return NextResponse.json({ error: 'Failed to update timesheet' }, { status: 500 });
    }
}
