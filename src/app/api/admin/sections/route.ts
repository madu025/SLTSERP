import { SectionService } from '@/services/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async () => {
    return SectionService.getSections();
}, { rawResponse: true });

export const POST = apiHandler(async (request) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const body = await request.json();
    if (!body.name || !body.code) {
        throw AppError.badRequest('Name and code are required');
    }

    return SectionService.createSection(body, userId || 'system');
}, { rawResponse: true });
