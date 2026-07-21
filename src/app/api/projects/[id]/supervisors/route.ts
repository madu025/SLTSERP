import { apiHandler } from '@/lib/api-handler';
import { ProjectSupervisorService } from '@/services/project-supervisor.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectSupervisorService.getAssignments(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { supervisorId, role } = body || {};

    if (!supervisorId) {
        throw AppError.badRequest('supervisorId is required');
    }

    try {
        return await ProjectSupervisorService.assignSupervisor(projectId, supervisorId, role);
    } catch (error: unknown) {
        const err = error as { message?: string };
        const message = err?.message;

        if (message === 'PROJECT_NOT_FOUND' || message === 'SUPERVISOR_NOT_FOUND') {
            throw AppError.notFound(message === 'PROJECT_NOT_FOUND' ? 'Project not found' : 'Supervisor user not found');
        }
        if (message === 'SUPERVISOR_ALREADY_ASSIGNED') {
            throw AppError.conflict('Supervisor already assigned to this project');
        }
        throw error;
    }
}, {
    audit: { action: 'ASSIGN_SUPERVISOR', entity: 'PROJECT' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
        throw AppError.badRequest('assignmentId is required');
    }

    try {
        await ProjectSupervisorService.removeAssignment(projectId, assignmentId);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'ASSIGNMENT_NOT_FOUND') {
            throw AppError.notFound('Assignment not found');
        }
        throw error;
    }
}, {
    audit: { action: 'REMOVE_SUPERVISOR', entity: 'PROJECT' },
    rawResponse: true
});