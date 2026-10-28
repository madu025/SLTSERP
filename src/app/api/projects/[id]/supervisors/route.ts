import { apiHandler } from '@/lib/api-handler';
import { ProjectSupervisorService } from '@/services/project/project-supervisor.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    return await ProjectSupervisorService.getAssignments(params.id);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const supervisorId = body.supervisorId as string | undefined;
    const role = body.role as string | undefined;

    if (!supervisorId) {
        throw AppError.badRequest('supervisorId is required');
    }

    try {
        return await ProjectSupervisorService.assignSupervisor(params.id, supervisorId, role, params._userId);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'ASSIGN_SUPERVISOR', entity: 'PROJECT' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
        throw AppError.badRequest('assignmentId is required');
    }

    try {
        await ProjectSupervisorService.removeAssignment(params.id, assignmentId, params._userId);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'ASSIGNMENT_NOT_FOUND') {
            throw AppError.notFound('Assignment not found');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'REMOVE_SUPERVISOR', entity: 'PROJECT' },
    rawResponse: true
});
