export const dynamic = 'force-dynamic';
import { SectionService } from '@/services/core/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
import { z } from 'zod';

const updateSectionSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(20).optional(),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    color: z.string().max(30).optional().nullable(),
    isActive: z.boolean().optional()
});

export const PATCH = apiHandler(async (request, params, body) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!hasRole(role, ROLE_GROUPS.SUPER_ADMINS)) {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const { id } = await params;
    const data = updateSectionSchema.parse(body);
    return SectionService.updateSection(id, data, userId || 'system');
}, { rawResponse: true });

export const DELETE = apiHandler(async (request, params) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!hasRole(role, ROLE_GROUPS.SUPER_ADMINS)) {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const { id } = await params;
    return SectionService.deleteSection(id, userId || 'system');
}, { rawResponse: true });
