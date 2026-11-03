export const dynamic = 'force-dynamic';
import { SectionService } from '@/services/core/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const updateSectionSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(20).optional(),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    color: z.string().max(30).optional().nullable(),
    isActive: z.boolean().optional()
}).strict();

export const PATCH = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = await params;
    const data = updateSectionSchema.parse(body);
    return SectionService.updateSection(id, data, userId);
}, {
    rawResponse: true,
    audit: { action: 'UPDATE', entity: 'SECTION' }
});

export const DELETE = apiHandler(async (_request, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { id } = await params;
    return SectionService.deleteSection(id, userId);
}, {
    rawResponse: true,
    audit: { action: 'DELETE', entity: 'SECTION' }
});
