import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signJWT } from '@/lib/auth';
import { SystemService } from '@/services/system.service';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { Role, Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface LoginCredentials {
    username: string;
    password?: string;
}

interface CreateUserData {
    username: string;
    email: string;
    password?: string;
    name?: string;
    role: Role;
    employeeId?: string;
    opmcIds?: string[];
    supervisorId?: string;
    assignedStoreId?: string;
    status?: string;
}

interface UpdateUserData {
    username: string;
    email: string;
    password?: string;
    name?: string;
    role: Role;
    employeeId?: string;
    opmcIds?: string[];
    supervisorId?: string;
    assignedStoreId?: string;
    status?: string;
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    SUPER_ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
    ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
    OSP_MANAGER: ['dashboard', 'service-orders', 'contractors'],
    AREA_MANAGER: ['dashboard', 'service-orders', 'contractors'],
    ENGINEER: ['dashboard', 'service-orders', 'contractors'],
    ASSISTANT_ENGINEER: ['dashboard', 'service-orders', 'contractors'],
    AREA_COORDINATOR: ['dashboard', 'service-orders', 'contractors'],
    QC_OFFICER: ['dashboard', 'service-orders', 'contractors'],
    MANAGER: ['dashboard', 'service-orders', 'contractors'],
    STORES_MANAGER: ['dashboard', 'inventory'],
    STORES_ASSISTANT: ['dashboard', 'inventory'],
    PROCUREMENT_OFFICER: ['dashboard', 'procurement', 'inventory'],
    FINANCE_MANAGER: ['dashboard', 'invoices'],
    FINANCE_ASSISTANT: ['dashboard', 'invoices'],
    INVOICE_MANAGER: ['dashboard', 'invoices'],
    INVOICE_ASSISTANT: ['dashboard', 'invoices'],
    SA_MANAGER: ['dashboard', 'restore-requests'],
    SA_ASSISTANT: ['dashboard', 'restore-requests'],
    OFFICE_ADMIN: ['dashboard', 'contractors', 'administration'],
    OFFICE_ADMIN_ASSISTANT: ['dashboard', 'contractors', 'administration'],
    SITE_OFFICE_STAFF: ['dashboard', 'contractors']
};

const SECTION_MAPPING: Record<string, string[]> = {
    'OSP_MANAGER': ['PROJECTS'],
    'AREA_MANAGER': ['PROJECTS'],
    'ENGINEER': ['PROJECTS'],
    'ASSISTANT_ENGINEER': ['PROJECTS'],
    'AREA_COORDINATOR': ['PROJECTS'],
    'QC_OFFICER': ['PROJECTS'],
    'MANAGER': ['NEW_CONNECTION'],
    'SA_MANAGER': ['SERVICE_ASSURANCE'],
    'SA_ASSISTANT': ['SERVICE_ASSURANCE'],
    'STORES_MANAGER': ['STORES'],
    'STORES_ASSISTANT': ['STORES'],
    'PROCUREMENT_OFFICER': ['PROCUREMENT', 'STORES'],
    'FINANCE_MANAGER': ['FINANCE'],
    'FINANCE_ASSISTANT': ['FINANCE'],
    'INVOICE_MANAGER': ['INVOICE'],
    'INVOICE_ASSISTANT': ['INVOICE'],
    'OFFICE_ADMIN': ['OFFICE_ADMIN'],
    'OFFICE_ADMIN_ASSISTANT': ['OFFICE_ADMIN'],
    'SITE_OFFICE_STAFF': ['OFFICE_ADMIN'],
    'SUPER_ADMIN': ['ADMIN', 'PROJECTS', 'NEW_CONNECTION', 'SERVICE_ASSURANCE', 'STORES', 'PROCUREMENT', 'FINANCE', 'INVOICE', 'OFFICE_ADMIN'],
    'ADMIN': ['ADMIN', 'PROJECTS', 'NEW_CONNECTION', 'SERVICE_ASSURANCE', 'STORES', 'PROCUREMENT', 'FINANCE', 'INVOICE', 'OFFICE_ADMIN']
};

export class UserService {
    /**
     * Authenticates a user and returns a token and user details.
     * Throws errors for invalid credentials or missing inputs.
     */
    static async login({ username, password }: LoginCredentials) {
        if (!username || !password) {
            throw new Error('USERNAME_PASSWORD_REQUIRED');
        }

        const user = await prisma.user.findUnique({
            where: { username: username.toLowerCase() },
            include: {
                accessibleOpmcs: { select: { id: true, name: true } },
                sectionAssignments: {
                    include: {
                        role: true
                    }
                }
            }
        });

        if (!user || user.status !== 'active') {
            throw new Error('INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new Error('INVALID_CREDENTIALS');
        }

        // Generate JWT Token
        const token = await signJWT({
            id: user.id,
            username: user.username,
            role: user.role,
            contractorId: user.contractorId || undefined,
        });

        const TEST_USERS = ['admin', 'testadmin', 'ospmanager', 'areamanager', 'storesmanager', 'coordinator', 'qcofficer', 'finance', 'stores', 'engineer'];
        const isTestUser = TEST_USERS.includes(username.toLowerCase());

        let permissions: string[] = [];
        if (user.permissions) {
            try {
                const parsed = JSON.parse(user.permissions);
                permissions = Array.isArray(parsed) ? parsed : [];
            } catch {
                permissions = [];
            }
        } else if (isTestUser) {
            const perms: string[] = (user.sectionAssignments || []).flatMap((a) => {
                try {
                    const parsed = JSON.parse(a.role?.permissions || '[]');
                    return Array.isArray(parsed) ? (parsed as string[]) : [];
                } catch {
                    return [];
                }
            });
            permissions = [...new Set(perms)];
            if (permissions.length === 0) {
                permissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
            }
        } else {
            // Basic users get empty permissions to hide all sections and fallback to helpdesk tickets only
            permissions = [];
        }

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                contractorId: user.contractorId,
                accessibleOpmcs: user.accessibleOpmcs,
                mustChangePassword: (user as unknown as { mustChangePassword: boolean }).mustChangePassword,
                permissions
            }
        };
    }

    /**
     * Retrieves all users with pagination and search
     */
    static async getUsers(page: number, limit: number, search?: string) {
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            status: { not: 'deleted' }
        };
        if (search) {
            where.AND = [
                { status: { not: 'deleted' } },
                {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { employeeId: { contains: search, mode: 'insensitive' } },
                        { username: { contains: search, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    staffId: true,
                    assignedStoreId: true,
                    accessibleOpmcs: { select: { id: true, rtom: true } },
                    supervisor: { select: { id: true, name: true, username: true, role: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return {
            users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Creates a new user with transactional section assignments
     */
    static async createUser(data: CreateUserData, currentUserId: string) {
        const { username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId, status } = data;

        // Validate OPMC requirement for New Connection & Service Assurance
        const requiresOPMC = ['MANAGER', 'SA_MANAGER', 'SA_ASSISTANT'].includes(role);
        if (requiresOPMC && (!opmcIds || opmcIds.length === 0)) {
            throw new Error('OPMC_REQUIRED');
        }

        if (!password) {
            throw new Error('PASSWORD_REQUIRED');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Staff record if employeeId is present
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

            // 2. Create User record
            const user = await tx.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    name,
                    role: role || 'ENGINEER',
                    status: status || 'active',
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: assignedStoreId && assignedStoreId !== 'none' ? { connect: { id: assignedStoreId } } : undefined,
                    accessibleOpmcs: {
                        connect: opmcIds && Array.isArray(opmcIds)
                            ? opmcIds.map((id: string) => ({ id }))
                            : []
                    },
                    supervisor: supervisorId && supervisorId !== 'none' ? { connect: { id: supervisorId } } : undefined
                },
                include: {
                    accessibleOpmcs: { select: { rtom: true } }
                }
            });
            // 3. Auto-assign to Sections based on Role (Multi-section support)
            const sectionCodes = SECTION_MAPPING[role] || [];
            
            // Optimize with Promise.all and upsert to avoid O(M) blocking sequential queries
            await Promise.all(sectionCodes.map(async (sectionCode) => {
                const section = await tx.section.upsert({
                    where: { code: sectionCode },
                    create: { name: sectionCode.replace(/_/g, ' '), code: sectionCode },
                    update: {}
                });

                const roleCode = `${sectionCode}_${role}`;
                const systemRole = await tx.systemRole.upsert({
                    where: { code: roleCode },
                    create: {
                        name: role.replace(/_/g, ' '),
                        code: roleCode,
                        sectionId: section.id,
                        permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard'])
                    },
                    update: {
                        permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard'])
                    }
                });

                await tx.userSectionAssignment.upsert({
                    where: {
                        userId_sectionId: { userId: user.id, sectionId: section.id }
                    },
                    create: {
                        userId: user.id,
                        sectionId: section.id,
                        roleId: systemRole.id,
                        isPrimary: sectionCode === sectionCodes[0]
                    },
                    update: {}
                });
            }));

            return user;
        });

        const userWithoutPassword = { ...result } as Partial<typeof result>;
        delete userWithoutPassword.password;

        // Log creation and Notify
        await SystemService.logEvent({
            userId: currentUserId || 'system',
            action: 'USER_CREATE',
            entity: 'User',
            entityId: result.id as string,
            newValue: userWithoutPassword,
            notify: true,
            notifyTitle: 'Welcome to SLT ERP',
            notifyMessage: `An administrator has created your account as ${role}. Please setup your security profile.`,
            notifyType: 'SYSTEM'
        });

        return userWithoutPassword;
    }

    /**
     * Updates an existing user record
     */
    static async updateUser(id: string, data: UpdateUserData, currentUserId: string) {
        const { username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId, status } = data;

        const existingUser = await prisma.user.findUnique({ where: { id }, include: { staff: true } });
        if (!existingUser) throw new Error('USER_NOT_FOUND');

        if (existingUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
            throw new Error('CANNOT_DEMOTE_SUPER_ADMIN');
        }

        const dataToUpdate: {
            username: string;
            email: string;
            name?: string;
            role: Role;
            password?: string;
            mustChangePassword?: boolean;
            status?: string;
        } = {
            username,
            email,
            name,
            role,
            status,
        };

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

            // If the role changed, clear old assignments and seed new templates
            if (existingUser.role !== role) {
                await tx.userSectionAssignment.deleteMany({ where: { userId: id } });

                const sectionCodes = SECTION_MAPPING[role] || [];
                
                await Promise.all(sectionCodes.map(async (sectionCode) => {
                    const section = await tx.section.upsert({
                        where: { code: sectionCode },
                        create: { name: sectionCode.replace(/_/g, ' '), code: sectionCode },
                        update: {}
                    });

                    const roleCode = `${sectionCode}_${role}`;
                    const systemRole = await tx.systemRole.upsert({
                        where: { code: roleCode },
                        create: {
                            name: role.replace(/_/g, ' '),
                            code: roleCode,
                            sectionId: section.id,
                            permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard'])
                        },
                        update: {
                            permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard'])
                        }
                    });

                    await tx.userSectionAssignment.create({
                        data: {
                            userId: id,
                            sectionId: section.id,
                            roleId: systemRole.id,
                            isPrimary: sectionCode === sectionCodes[0]
                        }
                    });
                }));
            }

            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...dataToUpdate,
                    permissions: existingUser.role !== role ? null : undefined,
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: assignedStoreId && assignedStoreId !== 'none' ? { connect: { id: assignedStoreId } } : { disconnect: true },
                    accessibleOpmcs: {
                        set: [],
                        connect: opmcIds ? opmcIds.map((oid: string) => ({ id: oid })) : []
                    },
                    supervisor: supervisorId && supervisorId !== 'none' ? { connect: { id: supervisorId } } : { disconnect: true }
                }
            });
            return updatedUser;
        });

        const userWithoutPassword = { ...result } as Partial<typeof result>;
        delete userWithoutPassword.password;

        await SystemService.logEvent({
            userId: currentUserId || 'system',
            action: 'USER_UPDATE',
            entity: 'User',
            entityId: result.id as string,
            oldValue: existingUser,
            newValue: userWithoutPassword,
            notify: true,
            notifyTitle: 'Profile Updated',
            notifyMessage: `Your account details have been updated by an administrator.`,
            notifyType: 'SYSTEM'
        });

        return userWithoutPassword;
    }

    static async deleteUser(id: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new Error('USER_NOT_FOUND');

        if (user.role === 'SUPER_ADMIN') {
            throw new Error('CANNOT_DELETE_SUPER_ADMIN');
        }

        try {
            // Delete cascade-safe related records to avoid blockages
            await prisma.userSectionAssignment.deleteMany({ where: { userId: id } });
            await prisma.notification.deleteMany({ where: { userId: id } });
            await prisma.notificationPreference.deleteMany({ where: { userId: id } });
            await prisma.pushSubscription.deleteMany({ where: { userId: id } });

            // Attempt physical deletion
            await prisma.user.delete({ where: { id } });
        } catch (error: any) {
            // Fallback to soft delete if a foreign key constraint prevents physical deletion (Prisma Code P2003)
            if (error?.code === 'P2003') {
                await prisma.user.update({
                    where: { id },
                    data: { status: 'deleted' }
                });
            } else {
                throw error;
            }
        }
        return { success: true };
    }

    /**
     * Initiates a forgot password workflow
     */
    static async forgotPasswordVerify(username: string, employeeId: string) {
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                employeeId: true,
                securityQuestion: true,
                securityAnswer: true
            }
        });

        if (!user) throw new Error('USER_NOT_FOUND');

        if (user.employeeId !== employeeId) {
            throw new Error('EMPLOYEE_ID_MISMATCH');
        }

        if (!user.securityQuestion || !user.securityAnswer) {
            throw new Error('SECURITY_QUESTION_NOT_SET');
        }

        // Generate temporary token
        const token = sign(
            { userId: user.id, step: 'verify' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        return {
            securityQuestion: user.securityQuestion,
            token
        };
    }

    /**
     * Verifies the answer of forgot password security question
     */
    static async forgotPasswordVerifyAnswer(token: string, answer: string) {
        let decoded: string | JwtPayload;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch {
            throw new Error('INVALID_TOKEN');
        }

        if (typeof decoded === 'string' || decoded.step !== 'verify') {
            throw new Error('INVALID_TOKEN');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                securityAnswer: true
            }
        });

        if (!user || !user.securityAnswer) {
            throw new Error('USER_NOT_FOUND');
        }

        const isCorrect = await bcrypt.compare(answer.toLowerCase().trim(), user.securityAnswer);
        if (!isCorrect) {
            throw new Error('INCORRECT_ANSWER');
        }

        // Generate reset token
        const resetToken = sign(
            { userId: user.id, step: 'reset' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        return {
            message: 'Security answer verified',
            token: resetToken
        };
    }

    /**
     * Resets password to a new value
     */
    static async forgotPasswordReset(token: string, newPassword: string) {
        if (newPassword.length < 6) {
            throw new Error('PASSWORD_TOO_SHORT');
        }

        let decoded: string | JwtPayload;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch {
            throw new Error('INVALID_TOKEN');
        }

        if (typeof decoded === 'string' || decoded.step !== 'reset') {
            throw new Error('INVALID_TOKEN');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: decoded.userId },
            data: { password: hashedPassword }
        });

        return { success: true };
    }

    /**
     * Fetches user profile by ID
     */
    static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                staff: true,
                accessibleOpmcs: {
                    select: {
                        id: true,
                        name: true,
                        rtom: true
                    }
                },
                assignedStore: {
                    select: {
                        id: true,
                        name: true,
                        location: true
                    }
                },
                supervisor: {
                    select: {
                        name: true,
                        role: true,
                        username: true
                    }
                },
                subordinates: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                sectionAssignments: {
                    include: {
                        section: {
                            select: {
                                name: true,
                                icon: true
                            }
                        },
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                auditLogs: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) throw new Error('USER_NOT_FOUND');
        return user;
    }

    /**
     * Changes password of profile user
     */
    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        if (newPassword.length < 6) {
            throw new Error('PASSWORD_TOO_SHORT');
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true
            }
        });

        if (!user) throw new Error('USER_NOT_FOUND');

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new Error('INCORRECT_PASSWORD');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword
            }
        });

        return { success: true };
    }

    /**
     * Updates basic user profile details (Name, Email)
     */
    static async updateProfile(userId: string, data: { name?: string; email?: string }) {
        if (!userId) throw new Error('USER_ID_REQUIRED');
        
        return prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                email: data.email
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        });
    }

    /**
     * Get user permissions
     */
    static async getUserPermissions(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { permissions: true }
        });

        const assignments = await prisma.userSectionAssignment.findMany({
            where: { userId: userId },
            include: {
                section: true,
                role: true
            }
        });

        return assignments.map(a => {
            if (user?.permissions) {
                return {
                    ...a,
                    role: {
                        ...a.role,
                        permissions: user.permissions
                    }
                };
            }
            return a;
        });
    }

    /**
     * Update user permissions
     */
    static async updateUserPermissions(userId: string, permissions: string[]) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                permissions: JSON.stringify(permissions)
            }
        });
    }

    /**
     * Get user section assignments
     */
    static async getUserSections(userId: string) {
        return prisma.userSectionAssignment.findMany({
            where: { userId: userId },
            include: {
                section: true,
                role: true
            },
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'asc' }
            ]
        });
    }

    /**
     * Assign section/role to user
     */
    static async assignUserSection(userId: string, data: { sectionId: string; roleId: string; isPrimary?: boolean }) {
        if (!data.sectionId || !data.roleId) {
            throw AppError.badRequest('Section and role are required');
        }

        if (data.isPrimary) {
            await prisma.userSectionAssignment.updateMany({
                where: { userId: userId, isPrimary: true },
                data: { isPrimary: false }
            });
        }

        try {
            return await prisma.userSectionAssignment.create({
                data: {
                    userId: userId,
                    sectionId: data.sectionId,
                    roleId: data.roleId,
                    isPrimary: data.isPrimary || false
                },
                include: {
                    section: true,
                    role: true
                }
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw AppError.badRequest('User already assigned to this section');
            }
            throw error;
        }
    }

    /**
     * Remove section assignment
     */
    static async removeUserSection(assignmentId: string) {
        try {
            await prisma.userSectionAssignment.delete({
                where: { id: assignmentId }
            });
            return { success: true };
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw AppError.notFound('Assignment not found');
            }
            throw error;
        }
    }
}
