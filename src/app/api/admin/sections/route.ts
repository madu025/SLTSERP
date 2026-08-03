export const dynamic = 'force-dynamic';

import { SectionService } from '@/services/core/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS, hasRole } from '@/config/roles';
import { z } from 'zod';

const createSectionSchema = z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20),
    description: z.string().max(500).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(30).optional()
});

export const GET = apiHandler(async () => {
    return SectionService.getSections();
}, { rawResponse: true });

export const POST = apiHandler(async (request, _params, body) => {
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!hasRole(role, ROLE_GROUPS.SUPER_ADMINS)) {
        throw AppError.forbidden('Only Super Admins can manage sections');
    }

    const data = createSectionSchema.parse(body);
    return SectionService.createSection(data, userId || 'system');
}, { rawResponse: true });
