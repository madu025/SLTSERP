import { SectionService } from '@/services/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const PATCH = apiHandler(async (request, { params }) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const { id } = await params;
    const body = await request.json();

    return SectionService.updateSection(id, body, userId || 'system');
}, { rawResponse: true });

export const DELETE = apiHandler(async (request, { params }) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'SUPER_ADMIN') {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const { id } = await params;
    
    return SectionService.deleteSection(id, userId || 'system');
}, { rawResponse: true });
