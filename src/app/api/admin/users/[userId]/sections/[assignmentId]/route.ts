export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';

// DELETE - Remove section assignment
export const DELETE = apiHandler(async (_req, params) => {
    const { assignmentId } = await params;
    
    await UserService.removeUserSection(assignmentId);

    return { message: 'Assignment removed successfully' };
}, {
    roles: ROLE_GROUPS.ADMINS,
    rawResponse: true,
    audit: { action: 'REMOVE_USER_SECTION', entity: 'User' }
});
