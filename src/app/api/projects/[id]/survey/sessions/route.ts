import { apiHandler } from '@/lib/api-handler';
import { ProjectSurveyService } from '@/services/project-survey.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supervisorId = searchParams.get('supervisorId');

    return await ProjectSurveyService.getSessions(projectId, { status, supervisorId });
}, { rawResponse: true });

export const POST = apiHandler(async (request, params, body) => {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    const { action, sessionId, notes } = body || {};

    if (action !== 'start' && action !== 'continue') {
        throw AppError.badRequest('Invalid action. Use "start" or "continue"');
    }

    try {
        const result = await ProjectSurveyService.startOrContinueSession(projectId, userId!, action, sessionId, notes);
        const status = result.action === 'started' ? 201 : 200;
        return Response.json(result, { status });
    } catch (error: unknown) {
        const err = error as { message?: string };
        const message = err?.message;

        if (message === 'SUPERVISOR_NOT_ASSIGNED') {
            throw AppError.forbidden('You are not assigned as supervisor for this project');
        }
        if (message === 'SESSION_ID_REQUIRED') {
            throw AppError.badRequest('sessionId required for continue action');
        }
        if (message === 'SESSION_NOT_FOUND_OR_UNAUTHORIZED') {
            throw AppError.notFound('Session not found or unauthorized');
        }
        if (message === 'SESSION_ALREADY_COMPLETED') {
            throw AppError.badRequest('Session is already completed');
        }
        if (message === 'SESSION_ABANDONED') {
            throw AppError.badRequest('Session was abandoned. Start a new session instead.');
        }
        throw error;
    }
}, {
    audit: { action: 'MANAGE_SESSION', entity: 'SURVEY' },
    rawResponse: true // Handled Response.json with custom status code
});

export const PATCH = apiHandler(async (request, params, body) => {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    const { sessionId, action, notes } = body || {};

    if (!sessionId) {
        throw AppError.badRequest('sessionId is required');
    }

    if (action !== 'complete' && action !== 'abandon') {
        throw AppError.badRequest('Invalid action. Use "complete" or "abandon"');
    }

    try {
        return await ProjectSurveyService.updateSessionStatus(projectId, userId!, sessionId, action, notes);
    } catch (error: unknown) {
        const err = error as { message?: string };
        const message = err?.message;

        if (message === 'SESSION_NOT_FOUND_OR_UNAUTHORIZED') {
            throw AppError.notFound('Session not found or unauthorized');
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE_SESSION', entity: 'SURVEY' },
    rawResponse: true
});