import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';
import { isDatabaseRole } from '@/lib/role-validation';
import { Role } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const roleSchema = z.custom<Role>(isDatabaseRole, { message: 'Invalid database role' });
const userFieldsSchema = {
    username: z.string().trim().min(3).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(4).max(128).optional(),
    name: z.string().trim().min(2).max(200).optional(),
    role: roleSchema,
    employeeId: z.string().trim().max(100).optional(),
    opmcIds: z.array(z.string().min(1).max(100)).max(100).optional(),
    supervisorId: z.string().min(1).max(100).optional(),
    assignedStoreId: z.string().min(1).max(100).optional(),
    status: z.enum(['active', 'inactive', 'deleted']).optional(),
};
const createUserSchema = z.object(userFieldsSchema).strict();
const updateUserSchema = z.object({ id: z.string().min(1).max(100), ...userFieldsSchema }).strict();
type CreateUserRequest = z.infer<typeof createUserSchema>;
type UpdateUserRequest = z.infer<typeof updateUserSchema>;

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
export const POST = apiHandler<unknown, CreateUserRequest>(async (request, params, body) => {
    const currentUserId = params._userId;
    if (!currentUserId) throw AppError.unauthorized('Authenticated administrator required');

    try {
        const userWithoutPassword = await UserService.createUser(body, currentUserId);
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
    schema: createUserSchema,
    audit: { action: 'USER_CREATE', entity: 'User' }
});

// UPDATE user
export const PUT = apiHandler<unknown, UpdateUserRequest>(async (request, params, body) => {
    const { id, ...userData } = body;
    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = params._userId;
    if (!currentUserId) throw AppError.unauthorized('Authenticated administrator required');

    try {
        const userWithoutPassword = await UserService.updateUser(id, userData, currentUserId);
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
    schema: updateUserSchema,
    audit: { action: 'USER_UPDATE', entity: 'User' }
});

// PATCH is intentionally NOT supported on /api/users. User updates (including
// OPMC reassignment) must go through the ADMINS-guarded PUT handler above.
// This explicit deny-all export keeps the route fail-closed: any future PATCH
export const PATCH = apiHandler(async () => {
    throw AppError.badRequest('PATCH is not supported on /api/users; use PUT');
}, { rawResponse: true });

// DELETE user
export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('ID required');

    const currentUserId = params._userId;
    if (!currentUserId) throw AppError.unauthorized('Authenticated administrator required');

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
