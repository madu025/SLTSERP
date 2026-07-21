import { apiHandler } from '@/lib/api-handler';
import { ProjectService } from '@/services/project.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id } = await params;

    try {
        const project = await ProjectService.getProjectDetails(id);
        return project;
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, { rawResponse: true });

export const DELETE = apiHandler(async (request, params) => {
    const userRole = request.headers.get('x-user-role');
    const { id } = await params;

    try {
        await ProjectService.deleteProject(id, userRole);
        return { success: true, message: 'Project deleted successfully' };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'FORBIDDEN') {
            throw AppError.forbidden('Unauthorized: Only Admin or Super Admin can delete projects');
        }
        if (err?.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'DELETE', entity: 'PROJECT' },
    rawResponse: true
});
