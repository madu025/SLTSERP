import { apiHandler } from '@/lib/api-handler';
import { TeamMemberService } from '@/services/team-member.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        throw AppError.badRequest('Missing token');
    }

    try {
        const member = await TeamMemberService.verifyUploadToken(token);
        return { isValid: true, member };
    } catch (error: any) {
        const message = error?.message;
        if (message === 'INVALID_TOKEN') {
            throw AppError.notFound('Invalid token');
        }
        if (message === 'TOKEN_EXPIRED') {
            throw new AppError('Link expired', undefined as any, 410);
        }
        throw error;
    }
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { token, data } = body || {};

    if (!token) {
        throw AppError.badRequest('Missing token');
    }

    try {
        await TeamMemberService.updateProfileByToken(token, data);
        return { success: true };
    } catch (error: any) {
        const message = error?.message;
        if (message === 'INVALID_TOKEN') {
            throw AppError.notFound('Invalid token');
        }
        if (message === 'TOKEN_EXPIRED') {
            throw new AppError('Link expired', undefined as any, 410);
        }
        throw error;
    }
}, { rawResponse: true });
