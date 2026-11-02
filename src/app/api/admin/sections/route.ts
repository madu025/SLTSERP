import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';

import { SectionService } from '@/services/core/section.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
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
    const userId = getAuthenticatedUserId();
    const data = createSectionSchema.parse(body);
    return SectionService.createSection(data, userId || 'system');
}, {
    rawResponse: true,
    audit: { action: 'CREATE', entity: 'SECTION' }
});
