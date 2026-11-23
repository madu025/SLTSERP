import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { assertDatabaseRole } from '@/lib/role-validation';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { SECTION_MAPPING } from '@/config/auth-defaults';
import { isContractorRole } from '@/config/roles';
import { SystemService } from '@/services/core/system.service';
import { EmailService } from '@/services/notification/email.service';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import {
    CONTRACTOR_LOGIN_ROLES, designationFitsRole, designationRoleOf, USER_STATUSES, USER_DEPARTMENTS, departmentRoles, normalizeUserStatus, passwordProblem, roleNeedsOpmc, roleNeedsStoreOrOpmc, isQaLeftoverRole,
} from '@/config/user-admin';

/**
 * Creating, editing and listing users, on the authorization model of docs/authorization-architecture.md:
 *  - the base role is the SystemRole in User.roleId (looked up by the role code; a role with no SystemRole is refused, never silently skipped)
 *  - module designations are UserSectionAssignment rows (the administrator picks them; the usual ones for the role are added when none are picked)
 *  - the OPMC allow-list is required for the roles whose data is scoped by region
 *  - User.permissions (the manual override) is never written here; it has its own audited endpoint
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface DesignationInput { sectionId: string; roleId: string; isPrimary?: boolean }

export interface AdminUserInput {
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
    /** When given, replaces the user's module designations. When omitted on create, the usual ones for the role are added. */
    designations?: DesignationInput[];
}

export interface UserListQuery { page: number; limit: number; search?: string; status?: string; dept?: string; includeContractors?: boolean }

const clean = (v: string | undefined | null) => (v ?? '').replace(/\0/g, '').trim();

/** The base SystemRole of a role code: the role of the same name, else its company-wide variant. */
async function resolveBaseRole(tx: Tx, role: string) {
    const found = await tx.systemRole.findFirst({ where: { code: { in: [role, `${role}_GLOBAL`] }, isActive: true }, select: { id: true, code: true } });
    if (!found) throw AppError.badRequest('NO_SYSTEM_ROLE', { message: `No active system role is defined for ${role}. Create it under Administration > Roles first, so the user is not left without permissions.` });
    return found;
}

function assertStatus(status: string | undefined): string {
    const s = normalizeUserStatus(status);
    if (!(USER_STATUSES as readonly string[]).includes(s)) throw AppError.badRequest('INVALID_STATUS', { message: `Status must be one of ${USER_STATUSES.join(', ')}` });
    return s;
}

function assertScope(role: string, opmcIds: string[] | undefined, storeId: string | undefined) {
    const hasOpmc = !!opmcIds && opmcIds.length > 0;
    if (roleNeedsOpmc(role) && !hasOpmc) {
        throw AppError.badRequest('OPMC_REQUIRED', { message: `Select at least one OPMC / RTOM for ${role.replace(/_/g, ' ')}. Without a region this user would see no orders.` });
    }
    if (roleNeedsStoreOrOpmc(role) && !hasOpmc && (!storeId || storeId === 'none')) {
        throw AppError.badRequest('STORE_OR_OPMC_REQUIRED', { message: 'Select the store this person works in, or at least one OPMC / RTOM.' });
    }
}

async function assertReferences(tx: Tx, data: { opmcIds?: string[]; supervisorId?: string; assignedStoreId?: string }, selfId?: string) {
    const ids = [...new Set(data.opmcIds ?? [])];
    if (ids.length) {
        const n = await tx.oPMC.count({ where: { id: { in: ids } } });
        if (n !== ids.length) throw AppError.badRequest('OPMC_NOT_FOUND', { message: 'One of the selected OPMC / RTOM regions no longer exists.' });
    }
    if (data.supervisorId && data.supervisorId !== 'none') {
        if (data.supervisorId === selfId) throw AppError.badRequest('SUPERVISOR_IS_SELF', { message: 'A user cannot be their own supervisor.' });
        const sup = await tx.user.findUnique({ where: { id: data.supervisorId }, select: { id: true, status: true, contractorId: true } });
        if (!sup || normalizeUserStatus(sup.status) === 'deleted') throw AppError.badRequest('SUPERVISOR_NOT_FOUND', { message: 'The selected supervisor does not exist.' });
        if (sup.contractorId) throw AppError.badRequest('SUPERVISOR_IS_CONTRACTOR', { message: 'A contractor user cannot be a supervisor.' });
    }
    if (data.assignedStoreId && data.assignedStoreId !== 'none') {
        const st = await tx.inventoryStore.findUnique({ where: { id: data.assignedStoreId }, select: { id: true } });
        if (!st) throw AppError.badRequest('STORE_NOT_FOUND', { message: 'The selected store does not exist.' });
    }
}

/** Designations the administrator may pick: SystemRoles that belong to a section and are not a base role. */
async function validatedDesignations(tx: Tx, input: DesignationInput[], callerId: string, baseRole: string) {
    const enumRoles = (await prisma.$queryRawUnsafe<Array<{ role: string }>>('SELECT unnest(enum_range(NULL::"Role")) AS role')).map((r) => r.role);
    const callerCanGrantAdmin = (await getUserEffectivePermissions(callerId)).includes(RBAC_PERMISSIONS.ADMIN_SUPER);
    const out: Array<{ sectionId: string; roleId: string; isPrimary: boolean }> = [];
    const seen = new Set<string>();
    for (const d of input) {
        if (seen.has(d.sectionId)) throw AppError.badRequest('DUPLICATE_SECTION', { message: 'A user can hold one designation per section.' });
        seen.add(d.sectionId);
        const role = await tx.systemRole.findUnique({ where: { id: d.roleId }, select: { id: true, code: true, sectionId: true, isActive: true, permissions: true, section: { select: { code: true } }, rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } } } });
        if (!role || !role.isActive || role.sectionId !== d.sectionId) throw AppError.badRequest('INVALID_DESIGNATION', { message: 'A selected designation does not belong to the chosen section.' });
        if (!designationFitsRole(role.code, role.section?.code ?? '', baseRole, enumRoles)) {
            throw AppError.badRequest('DESIGNATION_ROLE_MISMATCH', { message: `The ${role.code.replace(/_/g, ' ')} designation belongs to ${designationRoleOf(role.code, role.section?.code ?? '', enumRoles)?.replace(/_/g, ' ')}, not ${baseRole.replace(/_/g, ' ')}. Change the role first, or pick a designation that fits it.` });
        }
        // a designation that carries the administrator capability would turn any staff user into an administrator: only a Super Admin may hand it out
        const grants = deriveEffectivePermissions({ systemRole: role });
        if ((grants.includes(RBAC_PERMISSIONS.ADMIN_RBAC) || grants.includes(RBAC_PERMISSIONS.ADMIN_SUPER)) && !callerCanGrantAdmin) {
            throw AppError.forbidden(`The ${role.code.replace(/_/g, ' ')} designation gives administrator rights; only a Super Admin can assign it.`);
        }
        out.push({ sectionId: d.sectionId, roleId: d.roleId, isPrimary: !!d.isPrimary });
    }
    if (out.length && !out.some((o) => o.isPrimary)) out[0].isPrimary = true;
    return out;
}

/** The usual designations of a role (SECTION_MAPPING); only roles that already exist are used, nothing is invented. */
async function usualDesignations(tx: Tx, role: string) {
    const mapping = await SystemService.getConfig<Record<string, string[]>>('SECTION_MAPPING', SECTION_MAPPING);
    const out: Array<{ sectionId: string; roleId: string; isPrimary: boolean }> = [];
    for (const [i, sectionCode] of (mapping[role] ?? []).entries()) {
        const section = await tx.section.findUnique({ where: { code: sectionCode }, select: { id: true } });
        const sysRole = section ? await tx.systemRole.findUnique({ where: { code: `${sectionCode}_${role}` }, select: { id: true, isActive: true } }) : null;
        if (section && sysRole?.isActive) out.push({ sectionId: section.id, roleId: sysRole.id, isPrimary: i === 0 });
    }
    return out;
}

async function assertCanTouch(role: string, currentUserId: string, targetId?: string) {
    const caller = await getUserEffectivePermissions(currentUserId);
    const canSuper = caller.includes(RBAC_PERMISSIONS.ADMIN_SUPER);
    if (role === 'SUPER_ADMIN' && !canSuper) throw AppError.forbidden('CANNOT_ASSIGN_SUPER_ADMIN');
    if (targetId) {
        const target = await getUserEffectivePermissions(targetId);
        if (target.includes(RBAC_PERMISSIONS.ADMIN_RBAC) && !caller.includes(RBAC_PERMISSIONS.ADMIN_RBAC)) throw AppError.forbidden('CANNOT_MODIFY_SUPER_ADMIN');
        if (target.includes(RBAC_PERMISSIONS.ADMIN_SUPER)) {
            if (!canSuper) throw AppError.forbidden('CANNOT_MODIFY_SUPER_ADMIN');
            if (role !== 'SUPER_ADMIN') throw AppError.forbidden('CANNOT_DEMOTE_SUPER_ADMIN');
        }
    }
}

async function assertUnique(username: string, email: string, employeeId: string | undefined, selfId?: string) {
    const notSelf = selfId ? { id: { not: selfId } } : {};
    const [u, e, emp] = await Promise.all([
        prisma.user.findFirst({ where: { ...notSelf, username: { equals: username, mode: 'insensitive' } }, select: { id: true } }),
        prisma.user.findFirst({ where: { ...notSelf, email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
        employeeId ? prisma.user.findFirst({ where: { ...notSelf, employeeId }, select: { id: true } }) : null,
    ]);
    if (u) throw AppError.conflict('That username is already used by another account');
    if (e) throw AppError.conflict('That email address is already used by another account');
    if (emp) throw AppError.conflict('That Employee ID is already used by another account');
}

export class UserAdminService {
    static async list(q: UserListQuery) {
        const search = clean(q.search);
        // contractor logins are created and owned by the contractor registration: the staff list leaves them out unless asked
        const noContractors: Prisma.UserWhereInput = q.includeContractors ? {} : { role: { notIn: [...CONTRACTOR_LOGIN_ROLES] as Role[] } };
        const and: Prisma.UserWhereInput[] = [{ status: { not: 'deleted' } }, noContractors];
        if (search) {
            and.push({ OR: [
                { name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } },
            ] });
        }
        const status = q.status ? normalizeUserStatus(q.status) : '';
        if (status && status !== 'all') and.push({ status: { equals: status, mode: 'insensitive' } });
        const roles = q.dept && q.dept !== 'ALL' ? departmentRoles(q.dept) : null;
        if (roles) and.push({ role: { in: roles as Role[] } });
        const where: Prisma.UserWhereInput = { AND: and };
        const base: Prisma.UserWhereInput = { AND: [{ status: { not: 'deleted' } }, noContractors] };
        const cnt = (extra: Prisma.UserWhereInput) => prisma.user.count({ where: { AND: [base, extra] } });

        const [total, users, all, active, inactive, resigned, ...byDept] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                select: {
                    id: true, username: true, email: true, name: true, role: true, status: true, createdAt: true, lastLoginAt: true, employeeId: true,
                    staffId: true, assignedStoreId: true, contractorId: true, mustChangePassword: true, permissions: true,
                    systemRole: { select: { id: true, code: true, name: true } },
                    accessibleOpmcs: { select: { id: true, rtom: true } },
                    supervisor: { select: { id: true, name: true, username: true, role: true } },
                    sectionAssignments: { select: { id: true, isPrimary: true, section: { select: { id: true, name: true } }, role: { select: { id: true, name: true, code: true } } } },
                },
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: (q.page - 1) * q.limit,
                take: q.limit,
            }),
            prisma.user.count({ where: base }),
            cnt({ status: { equals: 'active', mode: 'insensitive' } }),
            cnt({ status: { equals: 'inactive', mode: 'insensitive' } }),
            cnt({ status: { equals: 'resigned', mode: 'insensitive' } }),
            ...USER_DEPARTMENTS.map((d) => cnt({ role: { in: d.roles as Role[] } })),
        ]);
        const departments: Record<string, number> = {};
        USER_DEPARTMENTS.forEach((d, i) => { departments[d.id] = byDept[i] as number; });
        return {
            // the raw override is not sent to the browser; whether one exists is
            users: users.map(({ permissions, ...u }) => ({ ...u, status: normalizeUserStatus(u.status), hasCustomGrants: permissions !== null && permissions !== undefined })),
            meta: { total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
            stats: { all, active, inactive, resigned, departments },
        };
    }

    /** What the user form offers: base roles that really have a SystemRole, and the designations by section. */
    static async formOptions() {
        const [enumRows, systemRoles, sections] = await Promise.all([
            prisma.$queryRawUnsafe<Array<{ role: string }>>('SELECT unnest(enum_range(NULL::"Role")) AS role'),
            prisma.systemRole.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, sectionId: true, rolePermissions: { select: { permissionDefinition: { select: { code: true } } } } } }),
            prisma.section.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
        ]);
        const enumRoles = enumRows.map((r) => r.role);
        const codes = new Set(systemRoles.map((r) => r.code));
        const baseAvailable = enumRoles.filter((r) => codes.has(r) || codes.has(`${r}_GLOBAL`));
        const designations = sections.map((s) => ({
            section: s,
            roles: systemRoles.filter((r) => r.sectionId === s.id && !enumRoles.includes(r.code) && !isQaLeftoverRole(r.code)).map((r) => ({ id: r.id, code: r.code, name: r.name, forRole: designationRoleOf(r.code, s.code, enumRoles) })),
        })).filter((s) => s.roles.length > 0);
        // which data domains a base role sees for every OPMC (scope.<domain>.all grants), so the form can say that no region is needed
        const scopeAll: Record<string, string[]> = {};
        for (const r of systemRoles) {
            if (!enumRoles.includes(r.code)) continue;
            const d = r.rolePermissions.map((p) => p.permissionDefinition?.code ?? '').filter((c) => /^scope..+.all$/.test(c)).map((c) => c.split('.')[1]);
            if (d.length) scopeAll[r.code] = d;
        }
        return { roles: enumRoles, baseAvailable, designations, scopeAll };
    }

    static async create(data: AdminUserInput, currentUserId: string) {
        const username = clean(data.username);
        const email = clean(data.email).toLowerCase();
        const name = clean(data.name) || username;
        const employeeId = clean(data.employeeId) || undefined;
        assertDatabaseRole(data.role);
        const role = data.role;
        if (username.length < 3) throw AppError.badRequest('Username must be at least 3 characters');
        // a contractor user belongs to a contractor company (User.contractorId), which this form cannot set: they are created from the contractor registration
        if (isContractorRole(role)) throw AppError.badRequest('CONTRACTOR_ROLE', { message: 'Contractor users are created from the contractor registration, not here.' });
        await assertCanTouch(role, currentUserId);
        const status = assertStatus(data.status);
        if (!data.password) throw AppError.badRequest('PASSWORD_REQUIRED');
        const pwProblem = passwordProblem(data.password);
        if (pwProblem) throw AppError.badRequest(pwProblem);
        assertScope(role, data.opmcIds, data.assignedStoreId);
        await assertUnique(username, email, employeeId);
        const hashed = await bcrypt.hash(data.password, 10);

        const result = await prisma.$transaction(async (tx) => {
            await assertReferences(tx, data);
            const base = await resolveBaseRole(tx, role);
            const designations = data.designations ? await validatedDesignations(tx, data.designations, currentUserId, role) : await usualDesignations(tx, role);

            let staffId: string | undefined;
            if (employeeId) {
                const staff = await tx.staff.findUnique({ where: { employeeId } });
                staffId = staff?.id ?? (await tx.staff.create({ data: { name, employeeId, designation: role, opmcId: data.opmcIds?.[0] } })).id;
            }
            const user = await tx.user.create({
                data: {
                    username, email, name, role, status, employeeId,
                    password: hashed,
                    passwordChangedAt: new Date(),
                    // the administrator chose this password: the person must choose their own at the first sign-in
                    mustChangePassword: true,
                    systemRole: { connect: { id: base.id } },
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: data.assignedStoreId && data.assignedStoreId !== 'none' ? { connect: { id: data.assignedStoreId } } : undefined,
                    accessibleOpmcs: { connect: [...new Set(data.opmcIds ?? [])].map((id) => ({ id })) },
                    supervisor: data.supervisorId && data.supervisorId !== 'none' ? { connect: { id: data.supervisorId } } : undefined,
                    sectionAssignments: { create: designations },
                },
                include: { accessibleOpmcs: { select: { id: true, rtom: true, name: true } }, assignedStore: { select: { id: true, name: true } }, sectionAssignments: true },
            });
            return user;
        }, { maxWait: 10_000, timeout: 30_000 });

        const { password: _pw, ...userWithoutPassword } = result;
        void _pw;
        await SystemService.logEvent({
            userId: currentUserId, action: 'USER_CREATE', entity: 'User', entityId: result.id, newValue: userWithoutPassword,
            notify: true, notifyTitle: 'Welcome to SLT ERP', notifyMessage: `An administrator has created your account as ${role.replace(/_/g, ' ')}. You must choose a new password when you first sign in.`, notifyType: 'SYSTEM',
        });
        await this.sendWelcomeEmail({ name, username, email, role });
        return userWithoutPassword;
    }

    static async update(id: string, data: AdminUserInput, currentUserId: string) {
        assertDatabaseRole(data.role);
        const role = data.role;
        const existing = await prisma.user.findUnique({ where: { id }, include: { staff: true } });
        if (!existing || normalizeUserStatus(existing.status) === 'deleted') throw AppError.notFound('USER_NOT_FOUND');
        await assertCanTouch(role, currentUserId, existing.id);

        const username = clean(data.username) || existing.username;
        const email = (clean(data.email) || existing.email).toLowerCase();
        const name = clean(data.name) || existing.name || username;
        const employeeId = clean(data.employeeId) || undefined;
        const status = data.status ? assertStatus(data.status) : normalizeUserStatus(existing.status);
        if (id === currentUserId && status !== 'active') throw AppError.badRequest('You cannot disable your own account');
        assertScope(role, data.opmcIds, data.assignedStoreId);
        await assertUnique(username, email, employeeId, id);
        const passwordGiven = !!(data.password && data.password.length > 0);
        if (passwordGiven) {
            const problem = passwordProblem(data.password);
            if (problem) throw AppError.badRequest(problem);
        }

        const roleChanged = existing.role !== role;
        if (roleChanged && isContractorRole(role)) throw AppError.badRequest('CONTRACTOR_ROLE', { message: 'A staff user cannot be changed into a contractor user here.' });
        const statusChanged = normalizeUserStatus(existing.status) !== status;

        const result = await prisma.$transaction(async (tx) => {
            await assertReferences(tx, data, id);
            const base = await resolveBaseRole(tx, role);
            let staffId = existing.staffId;
            if (employeeId) {
                const staff = await tx.staff.upsert({
                    where: { employeeId },
                    create: { name, employeeId, designation: role, opmcId: data.opmcIds?.[0] },
                    update: { name, designation: role, opmcId: data.opmcIds?.[0] },
                });
                staffId = staff.id;
            }
            // designations: replaced when the form sends them. A role change without a choice swaps only the OLD role's usual designations
            // for the new role's; every other designation the person holds (Fleet, Inventory, a second section...) is kept.
            if (data.designations) {
                const designations = await validatedDesignations(tx, data.designations, currentUserId, role);
                await tx.userSectionAssignment.deleteMany({ where: { userId: id } });
                if (designations.length) await tx.userSectionAssignment.createMany({ data: designations.map((d) => ({ ...d, userId: id })) });
            } else if (roleChanged) {
                const oldUsual = new Set((await usualDesignations(tx, existing.role)).map((d) => d.roleId));
                await tx.userSectionAssignment.deleteMany({ where: { userId: id, roleId: { in: [...oldUsual] } } });
                const kept = await tx.userSectionAssignment.findMany({ where: { userId: id }, select: { sectionId: true, isPrimary: true } });
                const heldSections = new Set(kept.map((k) => k.sectionId));
                let primaryHeld = kept.some((k) => k.isPrimary);
                for (const d of await usualDesignations(tx, role)) {
                    if (heldSections.has(d.sectionId)) continue;
                    await tx.userSectionAssignment.create({ data: { userId: id, sectionId: d.sectionId, roleId: d.roleId, isPrimary: !primaryHeld } });
                    primaryHeld = true;
                }
            }
            return tx.user.update({
                where: { id },
                data: {
                    username, email, name, role, status, employeeId: employeeId ?? null,
                    systemRole: { connect: { id: base.id } },
                    // a manual grant list belongs to the old role; the audited permissions endpoint sets a new one
                    permissions: roleChanged ? null : undefined,
                    ...(passwordGiven ? { password: await bcrypt.hash(data.password!, 10), passwordChangedAt: new Date(), mustChangePassword: true } : {}),
                    // any change that affects access ends the sessions already open
                    ...(roleChanged || statusChanged || passwordGiven ? { tokenVersion: { increment: 1 } } : {}),
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: data.assignedStoreId && data.assignedStoreId !== 'none' ? { connect: { id: data.assignedStoreId } } : { disconnect: true },
                    accessibleOpmcs: { set: [...new Set(data.opmcIds ?? [])].map((oid) => ({ id: oid })) },
                    supervisor: data.supervisorId && data.supervisorId !== 'none' ? { connect: { id: data.supervisorId } } : { disconnect: true },
                },
            });
        }, { maxWait: 10_000, timeout: 30_000 });

        const { password: _pw, ...userWithoutPassword } = result;
        void _pw;
        await SystemService.logEvent({
            userId: currentUserId, action: 'USER_UPDATE', entity: 'User', entityId: result.id, oldValue: existing, newValue: userWithoutPassword,
            notify: true, notifyTitle: 'Profile Updated', notifyMessage: 'Your account details have been updated by an administrator.', notifyType: 'SYSTEM', notifyUserId: id,
        });
        return userWithoutPassword;
    }

    /** Administrator sets a new password: it must follow the policy, the person must change it at the next sign-in, open sessions end. */
    static async resetPassword(id: string, password: string, currentUserId: string) {
        const problem = passwordProblem(password);
        if (problem) throw AppError.badRequest(problem);
        const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
        if (!target || normalizeUserStatus(target.status) === 'deleted') throw AppError.notFound('USER_NOT_FOUND');
        await assertCanTouch(target.role, currentUserId, id);
        await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(password, 10), passwordChangedAt: new Date(), mustChangePassword: true, tokenVersion: { increment: 1 } } });
        await SystemService.logEvent({ userId: currentUserId, action: 'USER_PASSWORD_RESET', entity: 'User', entityId: id, notify: true, notifyTitle: 'Password reset', notifyMessage: 'An administrator reset your password. You must choose a new one when you sign in.', notifyType: 'SYSTEM', notifyUserId: id });
    }

    /** Tells the person their account exists (never the password: the administrator hands that over). Failure must not undo the account. */
    private static async sendWelcomeEmail(u: { name: string; username: string; email: string; role: string }) {
        try {
            const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`;
            const vars = { user: u.name, username: u.username, role: u.role.replace(/_/g, ' '), loginUrl };
            const rendered = await NotificationTemplateEngineService.renderEmailByCode('USER_ACCOUNT_CREATED', vars);
            const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
            const subject = rendered?.subject ?? 'Your SLT ERP account is ready';
            const html = rendered?.html ?? `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;"><h2>Welcome to SLT ERP, ${esc(u.name)}</h2><p>An administrator created your account as <strong>${esc(vars.role)}</strong>.</p><p>Username: <strong>${esc(u.username)}</strong></p><p>Your administrator will give you the temporary password separately. You must choose a new password when you first sign in.</p><p><a href="${esc(loginUrl)}">Sign in</a></p></body></html>`;
            const text = rendered?.text ?? `Welcome to SLT ERP, ${u.name}. Your account (${u.username}) is ready as ${vars.role}. Your administrator will give you the temporary password separately; you must choose a new one at first sign-in. ${loginUrl}`;
            await EmailService.sendMail({ to: u.email, subject, text, html });
        } catch (e) {
            console.error('[USER_WELCOME_EMAIL_FAILED]', e instanceof Error ? e.message : e);
        }
    }
}
