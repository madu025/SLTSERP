import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const assignSectionSchema = z.object({
    sectionId: z.string().min(1, 'Section is required'),
    roleId: z.string().min(1, 'Role is required'),
    isPrimary: z.boolean().optional()
});

// GET - Fetch user's section assignments
export const GET = apiHandler(async (_req, params) => {
    const { userId } = await params;
    const assignments = await UserService.getUserSections(userId);

    return Response.json(assignments);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN']
});

// POST - Assign section/role to user
export const POST = apiHandler(async (_req, params, body) => {
    const { userId } = await params;
    const data = assignSectionSchema.parse(body);

    const assignment = await UserService.assignUserSection(userId, data);

    return Response.json(assignment, { status: 201 });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'ASSIGN_USER_SECTION', entity: 'User' }
});
