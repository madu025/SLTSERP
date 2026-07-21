import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

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
    description?: string;
    level?: number;
    permissions?: string;
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
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw AppError.badRequest('Role with this code already exists');
            }
            throw error;
        }
    }

    static async updateRole(roleId: string, data: UpdateRoleInput) {
        try {
            return await prisma.systemRole.update({
                where: { id: roleId },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.level !== undefined && { level: data.level }),
                    ...(data.permissions !== undefined && { permissions: data.permissions })
                }
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw AppError.notFound('Role not found');
            }
            throw error;
        }
    }

    static async deleteRole(roleId: string) {
        const count = await prisma.userSectionAssignment.count({
            where: { roleId }
        });

        if (count > 0) {
            throw AppError.badRequest('Cannot delete role that is assigned to users');
        }

        try {
            await prisma.systemRole.delete({
                where: { id: roleId }
            });
            return { success: true };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw AppError.notFound('Role not found');
            }
            throw error;
        }
    }
}
