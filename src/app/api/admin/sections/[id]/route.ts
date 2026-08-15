export const dynamic = 'force-dynamic';
import { SectionService } from '@/services/core/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';
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
    const userId = request.headers.get('x-user-id');
    const { id } = await params;
    const data = updateSectionSchema.parse(body);
    return SectionService.updateSection(id, data, userId || 'system');
}, {
    rawResponse: true,
    roles: ROLE_GROUPS.SUPER_ADMINS,
    audit: { action: 'UPDATE', entity: 'SECTION' }
});

export const DELETE = apiHandler(async (request, params) => {
    const userId = request.headers.get('x-user-id');
    const { id } = await params;
    return SectionService.deleteSection(id, userId || 'system');
}, {
    rawResponse: true,
    roles: ROLE_GROUPS.SUPER_ADMINS,
    audit: { action: 'DELETE', entity: 'SECTION' }
});
