import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { UserService, CreateUserData, UpdateUserData } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET all users
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const search = searchParams.get('search') || undefined;

    const result = await UserService.getUsers(page, limit, search);
    return result;
}, {
    rawResponse: true
});

// POST new user
export const POST = apiHandler(async (request, _params, body) => {
    const currentUserId = getAuthenticatedUserId() || 'system';

    try {
        const userWithoutPassword = await UserService.createUser(body as unknown as CreateUserData, currentUserId);
        return userWithoutPassword;
    } catch (error: unknown) {
        const errorCode = (error as { code?: string })?.code;
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorCode === 'P2002') {
            throw AppError.conflict('Username, Email, or Employee ID already exists');
        }
        if (errorMsg === 'OPMC_REQUIRED') {
            throw AppError.badRequest('OPMC selection is required for New Connection and Service Assurance roles');
        }
        if (errorMsg === 'CANNOT_ASSIGN_SUPER_ADMIN') {
            throw AppError.forbidden('Only a Super Admin can assign the SUPER_ADMIN role');
        }
        throw error;
    }
}, {
    audit: { action: 'USER_CREATE', entity: 'User' }
});

// UPDATE user
export const PUT = apiHandler(async (request, _params, body) => {
    const id = body.id as string | undefined;
    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = getAuthenticatedUserId() || 'system';

    try {
        const userWithoutPassword = await UserService.updateUser(id, body as unknown as UpdateUserData, currentUserId);
        return userWithoutPassword;
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        if (errorMsg === 'CANNOT_DEMOTE_SUPER_ADMIN') {
            throw AppError.forbidden('Cannot demote Super Admin');
        }
        if (errorMsg === 'CANNOT_ASSIGN_SUPER_ADMIN') {
            throw AppError.forbidden('Only a Super Admin can assign the SUPER_ADMIN role');
        }
        if (errorMsg === 'CANNOT_MODIFY_SUPER_ADMIN') {
            throw AppError.forbidden('Only a Super Admin can modify a Super Admin account');
        }
        throw error;
    }
}, {
    audit: { action: 'USER_UPDATE', entity: 'User' }
});

// PATCH is intentionally NOT supported on /api/users. User updates (including
// OPMC reassignment) must go through the ADMINS-guarded PUT handler above.
// This explicit deny-all export keeps the route fail-closed: any future PATCH
export const PATCH = apiHandler(async () => {
    throw AppError.badRequest('PATCH is not supported on /api/users; use PUT');
}, { rawResponse: true });

// DELETE user
export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = getAuthenticatedUserId() || undefined;

    try {
        await UserService.deleteUser(id, currentUserId);
        return { message: 'User deleted successfully' };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        if (errorMsg === 'CANNOT_DELETE_SUPER_ADMIN') {
            throw AppError.forbidden('Cannot delete Super Admin');
        }
        if (errorMsg === 'CANNOT_DELETE_OWN_ACCOUNT') {
            throw AppError.badRequest('You cannot delete your own account');
        }
        throw error;
    }
}, {
    audit: { action: 'USER_DELETE', entity: 'User' },
    rawResponse: true
});
