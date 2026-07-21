import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
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
    roles: ['ADMIN', 'SUPER_ADMIN'],
    rawResponse: true
});

// POST new user
export const POST = apiHandler(async (request, _params, body) => {
    const currentUserId = request.headers.get('x-user-id') || 'system';

    try {
        const userWithoutPassword = await UserService.createUser(body, currentUserId);
        return userWithoutPassword;
    } catch (error: any) {
        const errorCode = error?.code;
        const errorMsg = error?.message || '';
        if (errorCode === 'P2002') {
            throw AppError.badRequest('Username, Email, or Employee ID already exists');
        }
        if (errorMsg === 'OPMC_REQUIRED') {
            throw AppError.badRequest('OPMC selection is required for New Connection and Service Assurance roles');
        }
        throw error;
    }
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'USER_CREATE', entity: 'User' },
    rawResponse: true
});

// UPDATE user
export const PUT = apiHandler(async (request, _params, body) => {
    const { id } = body;
    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = request.headers.get('x-user-id') || 'system';

    try {
        const userWithoutPassword = await UserService.updateUser(id, body, currentUserId);
        return userWithoutPassword;
    } catch (error: any) {
        const errorMsg = error?.message || '';
        if (errorMsg === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        if (errorMsg === 'CANNOT_DEMOTE_SUPER_ADMIN') {
            throw AppError.forbidden('Cannot demote Super Admin');
        }
        throw error;
    }
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
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
    } catch (error: any) {
        const errorMsg = error?.message || '';
        if (errorMsg === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        if (errorMsg === 'CANNOT_DELETE_SUPER_ADMIN') {
            throw AppError.forbidden('Cannot delete Super Admin');
        }
        throw error;
    }
}, {
    roles: ['SUPER_ADMIN'],
    audit: { action: 'USER_DELETE', entity: 'User' },
    rawResponse: true
});
