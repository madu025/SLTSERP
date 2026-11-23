'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-utils';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { UserService } from '@/services/hr/user.service';
import { UserAdminService } from '@/services/hr/user-admin.service';
import { AppError } from '@/lib/error';

export interface UserActionInput {
    username: string;
    email: string;
    password?: string;
    name?: string;
    role: Role | string;
    employeeId?: string;
    opmcIds?: string[];
    supervisorId?: string;
    assignedStoreId?: string;
    status?: string;
    /** Module designations (section + role). Omitted: create adds the usual ones, edit leaves them as they are. */
    designations?: Array<{ sectionId: string; roleId: string; isPrimary?: boolean }>;
}

const toInput = (data: UserActionInput | UpdateUserActionData) => ({ ...data, role: data.role as Role }) as Parameters<typeof UserAdminService.create>[0];

const CODE_TEXT: Record<string, string> = {
    USER_NOT_FOUND: 'User not found',
    PASSWORD_REQUIRED: 'A password is required for a new user',
    CANNOT_ASSIGN_SUPER_ADMIN: 'Only a Super Admin can assign the SUPER_ADMIN role',
    CANNOT_MODIFY_SUPER_ADMIN: 'Only a Super Admin can modify a Super Admin account',
    CANNOT_DEMOTE_SUPER_ADMIN: 'A Super Admin cannot be given a lower role',
    INVALID_ROLE: 'That role is not valid',
};

function failure(error: unknown, fallback: string) {
    if (error instanceof AppError) return { success: false as const, error: (error.details as { message?: string } | undefined)?.message || CODE_TEXT[error.message] || error.message };
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') return { success: false as const, error: 'Username, Email, or Employee ID already exists' };
    console.error('[USER_ACTION_ERROR]', error);
    return { success: false as const, error: fallback };
}

// Creating and editing go through UserAdminService: one rule set (role, designations, OPMC, status, password policy) for the form, the API and the scripts.
export async function createUser(data: UserActionInput) {
    const currentUser = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const result = await UserAdminService.create(toInput(data), currentUser.id);
        revalidatePath('/admin/users');
        return { success: true as const, data: result };
    } catch (error: unknown) {
        return failure(error, 'Error creating user');
    }
}

export interface UpdateUserActionData extends Partial<UserActionInput> {
    id: string;
}

export async function updateUser(data: UpdateUserActionData) {
    const currentUser = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        const existing = await prisma.user.findUnique({ where: { id: data.id }, select: { username: true, email: true, role: true, name: true } });
        if (!existing) return { success: false as const, error: 'User not found' };
        // fields the form did not send keep their stored value
        const result = await UserAdminService.update(data.id, toInput({ ...data, username: data.username ?? existing.username, email: data.email ?? existing.email, role: data.role ?? existing.role }), currentUser.id);
        revalidatePath('/admin/users');
        return { success: true as const, data: result };
    } catch (error: unknown) {
        return failure(error, 'Error updating user');
    }
}

export async function resetUserPassword(id: string, password: string) {
    const currentUser = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);
    try {
        await UserAdminService.resetPassword(id, password, currentUser.id);
        return { success: true as const };
    } catch (error: unknown) {
        return failure(error, 'Could not reset the password');
    }
}

export async function deleteUser(id: string) {
    const currentUser = await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);

    try {
        if (currentUser.id === id) {
            return { success: false, error: 'You cannot delete your own account' };
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return { success: false, error: 'User not found' };

        await UserService.deleteUser(id, currentUser.id);

        revalidatePath('/admin/users');
        revalidatePath('/admin/audit-logs');
        return { success: true, message: 'User deleted successfully' };
    } catch (error: unknown) {
        console.error('[USER_ACTION_DELETE_ERROR]', error);
        let errorMsg = 'Error deleting user';
        if (error instanceof Error) {
            if (error.message === 'CANNOT_DELETE_SUPER_ADMIN') {
                errorMsg = 'Cannot delete Super Admin account';
            } else if (error.message === 'CANNOT_DELETE_OWN_ACCOUNT') {
                errorMsg = 'You cannot delete your own account';
            } else if (error.message === 'USER_NOT_FOUND') {
                errorMsg = 'User not found';
            } else {
                errorMsg = error.message;
            }
        }
        return { success: false, error: errorMsg };
    }
}
