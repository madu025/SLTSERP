import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET all users
export async function GET(request: Request) {
    try {
        // Security Check: Role Based Access Control
        // The middleware sets 'x-user-role' header
        const role = request.headers.get('x-user-role');

        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                staffId: true,
                assignedStoreId: true,
                accessibleOpmcs: { select: { id: true, rtom: true } },
                supervisor: { select: { id: true, name: true, username: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ message: 'Error fetching users', details: (error as any).message }, { status: 500 });
    }
}

// POST new user with enhanced registration and access control
export async function POST(request: Request) {
    try {
        // Security Check
        const currentUserRole = request.headers.get('x-user-role');
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId } = body;

        // Validate OPMC requirement for New Connection & Service Assurance
        const requiresOPMC = ['MANAGER', 'SA_MANAGER', 'SA_ASSISTANT'].includes(role);
        if (requiresOPMC && (!opmcIds || opmcIds.length === 0)) {
            return NextResponse.json({
                message: 'OPMC selection is required for New Connection and Service Assurance roles'
            }, { status: 400 });
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

            // 3. Auto-assign to Section based on Role (Existing logic kept same)
            const sectionMapping: Record<string, string> = {
                'OSP_MANAGER': 'PROJECTS',
                'AREA_MANAGER': 'PROJECTS',
                'ENGINEER': 'PROJECTS',
                'ASSISTANT_ENGINEER': 'PROJECTS',
                'AREA_COORDINATOR': 'PROJECTS',
                'QC_OFFICER': 'PROJECTS',
                'MANAGER': 'NEW_CONNECTION',
                'SA_MANAGER': 'SERVICE_ASSURANCE',
                'SA_ASSISTANT': 'SERVICE_ASSURANCE',
                'STORES_MANAGER': 'STORES',
                'STORES_ASSISTANT': 'STORES',
                'PROCUREMENT_OFFICER': 'PROCUREMENT',
                'FINANCE_MANAGER': 'FINANCE',
                'FINANCE_ASSISTANT': 'FINANCE',
                'INVOICE_MANAGER': 'INVOICE',
                'INVOICE_ASSISTANT': 'INVOICE',
                'OFFICE_ADMIN': 'OFFICE_ADMIN',
                'OFFICE_ADMIN_ASSISTANT': 'OFFICE_ADMIN',
                'SUPER_ADMIN': 'ADMIN',
                'ADMIN': 'ADMIN'
            };

            const sectionCode = sectionMapping[role];
            if (sectionCode) {
                // Find or create section
                let section = await tx.section.findUnique({ where: { code: sectionCode } });
                if (!section) {
                    // Create section if it doesn't exist
                    section = await tx.section.create({
                        data: {
                            name: sectionCode.replace(/_/g, ' '),
                            code: sectionCode
                        }
                    });
                }

                // Find or create role for this section
                const roleCode = `${sectionCode}_${role}`;
                let systemRole = await tx.systemRole.findUnique({ where: { code: roleCode } });
                if (!systemRole) {
                    systemRole = await tx.systemRole.create({
                        data: {
                            name: role.replace(/_/g, ' '),
                            code: roleCode,
                            sectionId: section.id,
                            permissions: JSON.stringify(['dashboard']) // Default permission
                        }
                    });
                }

                // Create user section assignment
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
        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Registration Error:', error);
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ message: 'Username, Email, or Employee ID already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating user', debug: (error as any).message }, { status: 500 });
    }
}

// UPDATE user
export async function PUT(request: Request) {
    try {
        // Security Check
        const currentUserRole = request.headers.get('x-user-role');
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, username, email, password, name, role, employeeId, opmcIds, supervisorId, assignedStoreId } = body;

        // Protection: Prevent modifying Super Admin role or username
        const existingUser = await prisma.user.findUnique({ where: { id }, include: { staff: true } });
        if (!existingUser) return NextResponse.json({ message: 'User not found' }, { status: 404 });

        if (existingUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Cannot demote Super Admin' }, { status: 403 });
        }

        const dataToUpdate: any = {
            username,
            email,
            name,
            role,
        };

        if (password && password.length > 0) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update/Link Staff
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

            // 2. Update User
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...dataToUpdate,
                    staff: staffId ? { connect: { id: staffId } } : undefined,
                    assignedStore: assignedStoreId && assignedStoreId !== 'none' ? { connect: { id: assignedStoreId } } : { disconnect: true },
                    accessibleOpmcs: {
                        set: [], // Clear existing
                        connect: opmcIds ? opmcIds.map((oid: string) => ({ id: oid })) : []
                    },
                    supervisor: supervisorId ? { connect: { id: supervisorId } } : { disconnect: true }
                }
            });
            return updatedUser;
        });

        const { password: _, ...userWithoutPassword } = result;
        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Update Error:', error);
        return NextResponse.json({ message: 'Error updating user' }, { status: 500 });
    }
}

// DELETE user
export async function DELETE(request: Request) {
    try {
        // Security Check
        const currentUserRole = request.headers.get('x-user-role');
        if (currentUserRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Forbidden: Only Super Admin can delete users' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

        if (user.role === 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Cannot delete Super Admin' }, { status: 403 });
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting user' }, { status: 500 });
    }
}
