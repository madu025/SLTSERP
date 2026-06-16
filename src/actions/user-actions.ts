'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-utils';
import bcrypt from 'bcryptjs';
import { SystemService } from '@/services/system.service';
import { revalidatePath } from 'next/cache';

export async function createUser(data: any) {
    const currentUser = await requireAuth(['ADMIN', 'SUPER_ADMIN']);

    try {
        const { username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId } = data;

        // Validate OPMC requirement
        const requiresOPMC = ['MANAGER', 'SA_MANAGER', 'SA_ASSISTANT'].includes(role);
        if (requiresOPMC && (!opmcIds || opmcIds.length === 0)) {
            return { success: false, error: 'OPMC selection is required for this role' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            let staffId = undefined;
            if (employeeId) {
                const existingStaff = await tx.staff.findUnique({ where: { employeeId } });
                if (existingStaff) {
                    staffId = existingStaff.id;
                } else {
                    const staff = await tx.staff.create({
                        data: {
                            name: name || username,
                            employeeId,
                            designation: role,
                            opmcId: opmcIds && opmcIds.length > 0 ? opmcIds[0] : undefined
                        }
                    });
                    staffId = staff.id;
                }
            }

            const user = await tx.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    name,
                    role: role || 'ENGINEER',
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: assignedStoreId && assignedStoreId !== 'none' ? { connect: { id: assignedStoreId } } : undefined,
                    accessibleOpmcs: {
                        connect: opmcIds && Array.isArray(opmcIds)
                            ? opmcIds.map((id: string) => ({ id }))
                            : []
                    },
                    supervisor: supervisorId ? { connect: { id: supervisorId } } : undefined
                },
                include: {
                    accessibleOpmcs: { select: { rtom: true } }
                }
            });

            // Mapping logic
            const sectionMapping: Record<string, string> = {
                'OSP_MANAGER': 'PROJECTS', 'AREA_MANAGER': 'PROJECTS', 'ENGINEER': 'PROJECTS',
                'ASSISTANT_ENGINEER': 'PROJECTS', 'AREA_COORDINATOR': 'PROJECTS', 'QC_OFFICER': 'PROJECTS',
                'MANAGER': 'NEW_CONNECTION', 'SA_MANAGER': 'SERVICE_ASSURANCE', 'SA_ASSISTANT': 'SERVICE_ASSURANCE',
                'STORES_MANAGER': 'STORES', 'STORES_ASSISTANT': 'STORES', 'PROCUREMENT_OFFICER': 'PROCUREMENT',
                'FINANCE_MANAGER': 'FINANCE', 'FINANCE_ASSISTANT': 'FINANCE', 'INVOICE_MANAGER': 'INVOICE',
                'INVOICE_ASSISTANT': 'INVOICE', 'OFFICE_ADMIN': 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT': 'OFFICE_ADMIN',
                'SUPER_ADMIN': 'ADMIN', 'ADMIN': 'ADMIN'
            };

            const sectionCode = sectionMapping[role];
            if (sectionCode) {
                let section = await tx.section.findUnique({ where: { code: sectionCode } });
                if (!section) {
                    section = await tx.section.create({
                        data: { name: sectionCode.replace(/_/g, ' '), code: sectionCode }
                    });
                }

                const roleCode = `${sectionCode}_${role}`;
                let systemRole = await tx.systemRole.findUnique({ where: { code: roleCode } });
                if (!systemRole) {
                    systemRole = await tx.systemRole.create({
                        data: {
                            name: role.replace(/_/g, ' '),
                            code: roleCode,
                            sectionId: section.id,
                            permissions: JSON.stringify(['dashboard'])
                        }
                    });
                }

                await tx.userSectionAssignment.create({
                    data: {
                        userId: user.id,
                        sectionId: section.id,
                        roleId: systemRole.id,
                        isPrimary: true
                    }
                });
            }

            return user;
        });

        const { password: _, ...userWithoutPassword } = result;

        await SystemService.logEvent({
            userId: currentUser.id,
            action: 'USER_CREATE',
            entity: 'User',
            entityId: result.id as string,
            newValue: userWithoutPassword,
            notify: true,
            notifyTitle: 'Welcome to SLT ERP',
            notifyMessage: `An administrator has created your account as ${role}.`,
            notifyType: 'SYSTEM'
        });

        revalidatePath('/admin/users');
        return { success: true, data: userWithoutPassword };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Username, Email, or Employee ID already exists' };
        }
        return { success: false, error: 'Error creating user' };
    }
}

export async function updateUser(data: any) {
    const currentUser = await requireAuth(['ADMIN', 'SUPER_ADMIN']);

    try {
        const { id, username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId } = data;

        const existingUser = await prisma.user.findUnique({ where: { id }, include: { staff: true } });
        if (!existingUser) return { success: false, error: 'User not found' };

        if (existingUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
            return { success: false, error: 'Cannot demote Super Admin' };
        }

        const dataToUpdate: any = { username, email, name, role };

        if (password && password.length > 0) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
            dataToUpdate.mustChangePassword = true;
        }

        const result = await prisma.$transaction(async (tx) => {
            let staffId = existingUser.staffId;
            if (employeeId) {
                const staff = await tx.staff.upsert({
                    where: { employeeId },
                    create: {
                        name: name || username,
                        employeeId,
                        designation: role,
                        opmcId: opmcIds && opmcIds.length > 0 ? opmcIds[0] : undefined
                    },
                    update: {
                        name: name || undefined,
                        designation: role,
                        opmcId: opmcIds && opmcIds.length > 0 ? opmcIds[0] : undefined
                    }
                });
                staffId = staff.id;
            }

            return await tx.user.update({
                where: { id },
                data: {
                    ...dataToUpdate,
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: assignedStoreId && assignedStoreId !== 'none' ? { connect: { id: assignedStoreId } } : { disconnect: true },
                    accessibleOpmcs: {
                        set: [],
                        connect: opmcIds ? opmcIds.map((oid: string) => ({ id: oid })) : []
                    },
                    supervisor: supervisorId ? { connect: { id: supervisorId } } : { disconnect: true }
                }
            });
        });

        const { password: _, ...userWithoutPassword } = result;

        await SystemService.logEvent({
            userId: currentUser.id,
            action: 'USER_UPDATE',
            entity: 'User',
            entityId: result.id as string,
            oldValue: existingUser,
            newValue: userWithoutPassword,
            notify: true,
            notifyTitle: 'Profile Updated',
            notifyMessage: `Your account details have been updated.`,
            notifyType: 'SYSTEM'
        });

        revalidatePath('/admin/users');
        return { success: true, data: userWithoutPassword };
    } catch (error: any) {
        return { success: false, error: 'Error updating user' };
    }
}

export async function deleteUser(id: string) {
    await requireAuth(['SUPER_ADMIN']);

    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return { success: false, error: 'User not found' };

        if (user.role === 'SUPER_ADMIN') {
            return { success: false, error: 'Cannot delete Super Admin' };
        }

        await prisma.user.delete({ where: { id } });
        revalidatePath('/admin/users');
        return { success: true, message: 'User deleted successfully' };
    } catch (error: any) {
        return { success: false, error: 'Error deleting user' };
    }
}
