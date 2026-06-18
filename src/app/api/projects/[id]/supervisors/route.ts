import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/supervisors - Get assigned supervisors
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assignments = await prisma.projectSupervisorAssignment.findMany({
      where: { projectId, status: 'ASSIGNED' },
      select: {
        id: true,
        supervisorId: true,
        role: true,
        assignedAt: true,
      },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    return NextResponse.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
  }
}

// POST /api/projects/[id]/supervisors - Assign a supervisor to the project
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { supervisorId, role } = body;

    if (!supervisorId) {
      return NextResponse.json({ error: 'supervisorId is required' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for duplicate assignment
    const existing = await prisma.projectSupervisorAssignment.findFirst({
      where: {
        projectId,
        supervisorId,
        status: 'ASSIGNED',
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Supervisor already assigned to this project' }, { status: 409 });
    }

    // Verify supervisor is a valid user with supervisor role
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { id: true, name: true, role: true },
    });

    if (!supervisor) {
      return NextResponse.json({ error: 'Supervisor user not found' }, { status: 404 });
    }

    const assignment = await prisma.projectSupervisorAssignment.create({
      data: {
        projectId,
        supervisorId,
        role: role || 'PRIMARY',
      },
    });

    // Update project status to SURVEY_IN_PROGRESS if still PLANNING
    if (project.status === 'PLANNING') {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'SURVEY_IN_PROGRESS' },
      });
    }

    return NextResponse.json(
      { ...assignment, supervisor: { id: supervisor.id, name: supervisor.name } },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign supervisor';
    console.error('Error assigning supervisor:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/supervisors - Remove a supervisor assignment
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const assignment = await prisma.projectSupervisorAssignment.findFirst({
      where: { id: assignmentId, projectId },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await prisma.projectSupervisorAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REMOVED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing supervisor:', error);
    return NextResponse.json({ error: 'Failed to remove supervisor' }, { status: 500 });
  }
}