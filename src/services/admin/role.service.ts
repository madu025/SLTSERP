import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { VALID_PERMISSION_KEYS } from '@/config/auth-defaults';

/** Typed Prisma error code extraction (zero `any`). */
function getPrismaCode(error: unknown): string | undefined {
    return (error as { code?: unknown })?.code as string | undefined;
}

/** Reject malformed or unknown permission keys before they reach the DB. */
function assertValidPermissionsJson(permissions: string) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(permissions);
    } catch {
        throw AppError.badRequest('Permissions must be a valid JSON array string');
    }

    if (!Array.isArray(parsed)) {
        throw AppError.badRequest('Permissions must be a valid JSON array string');
    }

    const allowed = new Set<string>(VALID_PERMISSION_KEYS);
    for (const item of parsed) {
        if (typeof item !== 'string' || !allowed.has(item)) {
            throw AppError.badRequest(`Unknown permission key: ${typeof item === 'string' ? item : JSON.stringify(item)}`);
        }
    }
}

export interface CreateRoleInput {
    sectionId: string;
    name: string;
    code: string;
    description?: string;
    level?: number;
    permissions?: string;
}

export interface UpdateRoleInput {
    name?: string;
    code?: string;
    description?: string;
    level?: number;
    permissions?: string;
    isActive?: boolean;
}

export class RoleService {
    static async getRolesBySection(sectionId: string) {
        return prisma.systemRole.findMany({
            where: { sectionId },
            include: {
                _count: {
                    select: { userAssignments: true }
                }
            },
            orderBy: [
                { level: 'desc' },
                { name: 'asc' }
            ]
        });
    }

    static async createRole(data: CreateRoleInput) {
        if (!data.name || !data.code) {
            throw AppError.badRequest('Name and code are required');
        }
        if (data.permissions !== undefined) {
            assertValidPermissionsJson(data.permissions);
        }

        try {
            return await prisma.systemRole.create({
                data: {
                    name: data.name,
                    code: data.code.toUpperCase(),
                    sectionId: data.sectionId,
                    description: data.description,
                    level: data.level || 1,
                    permissions: data.permissions || '[]'
                }
            });
        } catch (error: unknown) {
            if (getPrismaCode(error) === 'P2002') {
                throw AppError.badRequest('Role with this code already exists');
            }
            throw error;
        }
    }

    static async updateRole(roleId: string, data: UpdateRoleInput) {
        if (data.permissions !== undefined) {
            assertValidPermissionsJson(data.permissions);
        }
        try {
            return await prisma.systemRole.update({
                where: { id: roleId },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.code && { code: data.code.toUpperCase() }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.level !== undefined && { level: data.level }),
                    ...(data.permissions !== undefined && { permissions: data.permissions }),
                    ...(data.isActive !== undefined && { isActive: data.isActive })
                }
            });
        } catch (error: unknown) {
            if (getPrismaCode(error) === 'P2025') {
                throw AppError.notFound('Role not found');
            }
            if (getPrismaCode(error) === 'P2002') {
                throw AppError.badRequest('Role with this code already exists');
            }
            throw error;
        }
    }

    static async deleteRole(roleId: string) {
        try {
            // Atomic: verify no assignments and delete in one transaction
            // to close the race window before the onDelete: Cascade FK fires.
            await prisma.$transaction(async (tx) => {
                const count = await tx.userSectionAssignment.count({
                    where: { roleId }
                });

                if (count > 0) {
                    throw AppError.badRequest('Cannot delete role that is assigned to users');
                }

                await tx.systemRole.delete({
                    where: { id: roleId }
                });
            });
            return { id: roleId, success: true };
        } catch (error: unknown) {
            if (getPrismaCode(error) === 'P2025') {
                throw AppError.notFound('Role not found');
            }
            throw error;
        }
    }
}
