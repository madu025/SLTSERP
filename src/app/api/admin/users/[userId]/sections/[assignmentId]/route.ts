import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';

// DELETE - Remove section assignment
export const DELETE = apiHandler(async (_req, params) => {
    const { assignmentId } = await params;
    
    await UserService.removeUserSection(assignmentId);

    return Response.json({ message: 'Assignment removed successfully' });
}, {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'REMOVE_USER_SECTION', entity: 'User' }
});
