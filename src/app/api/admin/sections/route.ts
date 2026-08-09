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

export const POST = apiHandler(async (_request, _params, body) => {
    const userId = _request.headers.get('x-user-id');
    const data = createSectionSchema.parse(body);
    return SectionService.createSection(data, userId || 'system');
}, {
    rawResponse: true,
    roles: ROLE_GROUPS.SUPER_ADMINS,
    audit: { action: 'CREATE', entity: 'SECTION' }
});
