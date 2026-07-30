import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { UserService, CreateUserData, UpdateUserData } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET all users
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || undefined;

    const result = await UserService.getUsers(page, limit, search);
    return result;
}, {
    roles: ROLE_GROUPS.ADMINS,
    rawResponse: true
});

// POST new user
export const POST = apiHandler(async (request, _params, body) => {
    const currentUserId = request.headers.get('x-user-id') || 'system';

    try {
        const userWithoutPassword = await UserService.createUser(body as unknown as CreateUserData, currentUserId);
        return userWithoutPassword;
    } catch (error: unknown) {
        const errorCode = (error as { code?: string })?.code;
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorCode === 'P2002') {
            throw AppError.badRequest('Username, Email, or Employee ID already exists');
        }
        if (errorMsg === 'OPMC_REQUIRED') {
            throw AppError.badRequest('OPMC selection is required for New Connection and Service Assurance roles');
        }
        throw error;
    }
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'USER_CREATE', entity: 'User' },
    rawResponse: true
});

// UPDATE user
export const PUT = apiHandler(async (request, _params, body) => {
    const id = body.id as string | undefined;
    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = request.headers.get('x-user-id') || 'system';

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
        throw error;
    }
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'USER_UPDATE', entity: 'User' },
    rawResponse: true
});

// DELETE user
export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('ID required');

    try {
        await UserService.deleteUser(id);
        return { message: 'User deleted successfully' };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        if (errorMsg === 'CANNOT_DELETE_SUPER_ADMIN') {
            throw AppError.forbidden('Cannot delete Super Admin');
        }
        throw error;
    }
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'USER_DELETE', entity: 'User' },
    rawResponse: true
});
