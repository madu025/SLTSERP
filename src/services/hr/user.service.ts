import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signJWT, signAccessToken, signRefreshToken } from '@/lib/auth';
import { SystemService } from '@/services/core/system.service';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { Role, Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
import { safe, safeSync } from '@/utils/safe-await.util';
import { requireEnv } from '@/lib/env';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/** Fail-closed: JWT signing must never run on a hardcoded default secret */
function getJwtSecret(): string {
    return requireEnv('JWT_SECRET');
}

interface LoginCredentials {
    username: string;
    password?: string;
}

export interface CreateUserData {
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
    designations?: DesignationInput[];
}

export interface UpdateUserData {
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
    designations?: DesignationInput[];
}

import { UserAdminService, type DesignationInput } from '@/services/hr/user-admin.service';
import { passwordProblem } from '@/config/user-admin';

export class UserService {
    /**
     * Authenticates a user and returns a token and user details.
     * Throws errors for invalid credentials or missing inputs.
     */
    static async login({ username, password }: LoginCredentials) {
        if (!username || !password) {
            throw AppError.badRequest('USERNAME_PASSWORD_REQUIRED');
        }

        // Strip null bytes to prevent PostgreSQL UTF8 encoding error (22021)
        const sanitizedUsername = username.replace(/\0/g, '').trim();
        if (!sanitizedUsername) {
            throw AppError.badRequest('USERNAME_PASSWORD_REQUIRED');
        }

        const user = await prisma.user.findFirst({
            where: {
                username: { equals: sanitizedUsername, mode: 'insensitive' }
            },
            include: {
                accessibleOpmcs: { select: { id: true, name: true } },
                systemRole: {
                    include: { rolePermissions: { include: { permissionDefinition: true } } }
                },
                sectionAssignments: {
                    include: {
                        role: { include: { rolePermissions: { include: { permissionDefinition: true } } } }
                    }
                }
            }
        });

        if (!user || user.status?.toLowerCase() !== 'active') {
            throw AppError.unauthorized('INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw AppError.unauthorized('INVALID_CREDENTIALS');
        }

        // Permission derivation priority (consolidated SystemRole system):
        // 1. Explicit user.permissions column (admin override)
        // 2. SystemRole permissions from sectionAssignments (unified role system)
        // 3. Empty (helpdesk-only access — no fallback to legacy defaults)
        const permissions = deriveEffectivePermissions(user);
        // No fallback — if no permissions derived, user gets helpdesk-only access

        // Generate JWT Tokens (access + refresh pair)
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            contractorId: user.contractorId || undefined,
            tokenVersion: user.tokenVersion,
            // Permissions from DB — middleware uses these for route-level RBAC
            // so admin-configured permissions work end-to-end without hardcoding.
            permissions: permissions.length > 0 ? permissions : undefined,
            // Forced password-change lockdown flag — middleware uses this claim
            // to block page navigation until the password is rotated.
            mustChangePassword: (user as unknown as { mustChangePassword: boolean }).mustChangePassword || undefined,
        };

        const [token, refreshToken] = await Promise.all([
            signAccessToken(tokenPayload),
            signRefreshToken({
                userId: user.id,
                role: user.role as string,
                tokenVersion: user.tokenVersion,
                contractorId: user.contractorId || undefined,
            }),
        ]);

        return {
            token,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                contractorId: user.contractorId,
                accessibleOpmcs: user.accessibleOpmcs,
                mustChangePassword: (user as unknown as { mustChangePassword: boolean }).mustChangePassword,
                permissions,
                // the base role and the module designations: the menu shows each module by what the person does in it
                designations: [...new Set([user.systemRole?.code, ...user.sectionAssignments.map((a) => a.role?.code)].filter((c): c is string => !!c))]
            }
        };
    }

    /** Lists users (paging, search, status and department filters, counts). The implementation is UserAdminService. */
    static async getUsers(page: number, limit: number, search?: string, filters: { status?: string; dept?: string } = {}) {
        return UserAdminService.list({ page, limit, search, ...filters });
    }

    /** Creates a user on the RBAC model (see UserAdminService). */
    static async createUser(data: CreateUserData, currentUserId: string) {
        return UserAdminService.create(data, currentUserId);
    }

    /** Updates a user on the RBAC model (see UserAdminService). */
    static async updateUser(id: string, data: UpdateUserData, currentUserId: string) {
        return UserAdminService.update(id, data, currentUserId);
    }

    static async deleteUser(id: string, currentUserId: string) {
        const callerPermissions = await getUserEffectivePermissions(currentUserId);
        if (!callerPermissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) {
            throw AppError.forbidden('Admin RBAC capability is required');
        }

        if (currentUserId === id) {
            throw AppError.badRequest('CANNOT_DELETE_OWN_ACCOUNT');
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                status: true
            }
        });
        if (!user) throw AppError.notFound('USER_NOT_FOUND');

        const targetPermissions = await getUserEffectivePermissions(user.id);
        if (targetPermissions.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) {
            throw AppError.forbidden('CANNOT_DELETE_SUPER_ADMIN');
        }

        // Clean up relations and mark user as deleted in a single transaction.
        // Note: Physical deletion (DELETE FROM "User") must NEVER be performed because
        // AuditLog is an immutable ledger with trigger fn_audit_log_immutable that throws
        // P0001 if foreign-key ON DELETE SET NULL attempts to mutate past audit records.
        await prisma.$transaction(async (tx) => {
            // 1. Delete cascade-safe related access/notification records
            await tx.userSectionAssignment.deleteMany({ where: { userId: id } });
            await tx.notificationPreference.deleteMany({ where: { userId: id } });
            await tx.pushSubscription.deleteMany({ where: { userId: id } });

            // 2. Disconnect subordinates and delegations
            await tx.user.updateMany({ where: { supervisorId: id }, data: { supervisorId: null } });
            await tx.user.updateMany({ where: { delegatedUserId: id }, data: { delegatedUserId: null } });

            // 3. Mark user status as 'deleted', bump tokenVersion to revoke active sessions,
            // and disconnect store and OPMC access
            await tx.user.update({
                where: { id },
                data: {
                    status: 'deleted',
                    tokenVersion: { increment: 1 },
                    assignedStoreId: null,
                    supervisorId: null,
                    delegatedUserId: null,
                    accessibleOpmcs: { set: [] }
                }
            });
        });

        // 4. Log the audit event to the AuditLog table for administrative compliance
        await SystemService.logEvent({
            userId: currentUserId,
            action: 'USER_DELETE',
            entity: 'User',
            entityId: id,
            oldValue: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status
            },
            newValue: {
                status: 'deleted'
            }
        });

        return { success: true };
    }

    /**
     * Initiates a forgot password workflow
     */
    static async forgotPasswordVerify(username: string, employeeId: string) {
        // Strip null bytes to prevent PostgreSQL UTF8 encoding error (22021)
        const sanitizedUsername = username.replace(/\0/g, '').trim();
        const sanitizedEmployeeId = employeeId.replace(/\0/g, '').trim();
        if (!sanitizedUsername || !sanitizedEmployeeId) {
            throw AppError.badRequest('USERNAME_AND_EMPLOYEE_ID_REQUIRED');
        }

        const user = await prisma.user.findUnique({
            where: { username: sanitizedUsername },
            select: {
                id: true,
                username: true,
                employeeId: true,
                securityQuestion: true,
                securityAnswer: true
            }
        });

        if (!user) throw AppError.notFound('USER_NOT_FOUND');

        if (user.employeeId !== sanitizedEmployeeId) {
            throw AppError.badRequest('EMPLOYEE_ID_MISMATCH');
        }

        if (!user.securityQuestion || !user.securityAnswer) {
            throw AppError.badRequest('SECURITY_QUESTION_NOT_SET');
        }

        // Generate temporary token
        const token = sign(
            { userId: user.id, step: 'verify' },
            getJwtSecret(),
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
        const [err, decoded] = safeSync<string | JwtPayload>(() => verify(token, getJwtSecret()));
        if (err || !decoded) {
            throw AppError.unauthorized('INVALID_TOKEN');
        }

        if (typeof decoded === 'string' || decoded.step !== 'verify') {
            throw AppError.unauthorized('INVALID_TOKEN');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                securityAnswer: true
            }
        });

        if (!user || !user.securityAnswer) {
            throw AppError.notFound('USER_NOT_FOUND');
        }

        const isCorrect = await bcrypt.compare(answer.toLowerCase().trim(), user.securityAnswer);
        if (!isCorrect) {
            throw AppError.unauthorized('INCORRECT_ANSWER');
        }

        // Generate reset token
        const resetToken = sign(
            { userId: user.id, step: 'reset' },
            getJwtSecret(),
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
        const pwProblem = passwordProblem(newPassword);
        if (pwProblem) {
            throw AppError.badRequest(pwProblem);
        }

        const [err, decoded] = safeSync<string | JwtPayload>(() => verify(token, getJwtSecret()));
        if (err || !decoded) {
            throw AppError.unauthorized('INVALID_TOKEN');
        }

        if (typeof decoded === 'string' || decoded.step !== 'reset') {
            throw AppError.unauthorized('INVALID_TOKEN');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Bump tokenVersion to invalidate all existing sessions
        // (prevents a compromised old token from surviving a password reset)
        await prisma.user.update({
            where: { id: decoded.userId },
            data: {
                password: hashedPassword,
                passwordChangedAt: new Date(),
                tokenVersion: { increment: 1 }
            }
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

        if (!user) throw AppError.notFound('USER_NOT_FOUND');
        // Never hand credential material or raw audit payloads to the browser
        const { password: _password, securityAnswer: _securityAnswer, tokenVersion: _tokenVersion, auditLogs, ...safeUser } = user as typeof user & { securityAnswer?: unknown; tokenVersion?: unknown };
        return {
            ...safeUser,
            auditLogs: (auditLogs ?? []).map(({ oldValue: _old, newValue: _new, ...log }) => log),
        };
    }

    /**
     * Changes password of profile user
     */
    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const pwProblem = passwordProblem(newPassword);
        if (pwProblem) {
            throw AppError.badRequest(pwProblem);
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true
            }
        });

        if (!user) throw AppError.notFound('USER_NOT_FOUND');

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw AppError.unauthorized('INCORRECT_PASSWORD');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword,
                passwordChangedAt: new Date(),
                // Clear the forced-rotation flag once the password is rotated —
                // otherwise the account stays locked after re-login (infinite loop).
                mustChangePassword: false,
                // Invalidate all existing sessions on password change
                tokenVersion: { increment: 1 }
            },
            select: { id: true, username: true, role: true, contractorId: true, tokenVersion: true }
        });

        // Issue a fresh session token pair carrying the bumped tokenVersion and no
        // mustChangePassword claim — the client swaps its cookie in-place and
        // continues without a forced re-login.
        const [token, refreshToken] = await Promise.all([
            signJWT({
                id: updatedUser.id,
                username: updatedUser.username,
                role: updatedUser.role,
                contractorId: updatedUser.contractorId || undefined,
                tokenVersion: updatedUser.tokenVersion,
            }),
            signRefreshToken({
                userId: updatedUser.id,
                role: updatedUser.role as string,
                tokenVersion: updatedUser.tokenVersion,
                contractorId: updatedUser.contractorId || undefined,
            }),
        ]);

        return { success: true, token, refreshToken };
    }

    /**
     * Updates basic user profile details (Name, Email)
     */
    static async updateProfile(userId: string, data: { name?: string; email?: string }) {
        if (!userId) throw AppError.badRequest('USER_ID_REQUIRED');
        
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
     * Direct permission override. Deliberately kept as the ONLY write path for
     * User.permissions and exposed solely to SUPER_ADMIN via the admin route —
     * granting permissions outside the role model is a super-admin power.
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

        const [err, assignment] = await safe(prisma.userSectionAssignment.create({
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
        }));

        if (err) {
            if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
                throw AppError.badRequest('User already assigned to this section');
            }
            throw err;
        }

        return assignment;
    }

    /**
     * Remove section assignment
     */
    static async removeUserSection(assignmentId: string) {
        const [err] = await safe(prisma.userSectionAssignment.delete({
            where: { id: assignmentId }
        }));

        if (err) {
            if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
                throw AppError.notFound('Assignment not found');
            }
            throw err;
        }

        return { success: true };
    }
}
