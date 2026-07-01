import { NextResponse } from 'next/server';
import { ProjectSupervisorService } from '@/services/project-supervisor.service';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/supervisors - Get assigned supervisors
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assignments = await ProjectSupervisorService.getAssignments(projectId);
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

    const assignment = await ProjectSupervisorService.assignSupervisor(projectId, supervisorId, role);
    return NextResponse.json(assignment, { status: 201 });
  } catch (error: any) {
    console.error('Error assigning supervisor:', error);
    const message = error.message;
    if (message === 'PROJECT_NOT_FOUND' || message === 'SUPERVISOR_NOT_FOUND') {
      return NextResponse.json({ error: message === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Supervisor user not found' }, { status: 404 });
    }
    if (message === 'SUPERVISOR_ALREADY_ASSIGNED') {
      return NextResponse.json({ error: 'Supervisor already assigned to this project' }, { status: 409 });
    }
    return NextResponse.json({ error: message || 'Failed to assign supervisor' }, { status: 500 });
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

    await ProjectSupervisorService.removeAssignment(projectId, assignmentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing supervisor:', error);
    const message = error.message;
    if (message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to remove supervisor' }, { status: 500 });
  }
}