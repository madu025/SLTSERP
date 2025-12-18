import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET all users
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                staffId: true,
                accessibleOpmcs: { select: { id: true, rtom: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
    }
}

// POST new user with enhanced registration and access control
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, email, password, name, role, employeeId, opmcIds } = body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Staff record if employeeId is present
            let staffId = undefined;
            if (employeeId) {
                // Check if staff exists to link or create new
                const existingStaff = await tx.staff.findUnique({ where: { employeeId } });

                if (existingStaff) {
                    staffId = existingStaff.id;
                } else {
                    const staff = await tx.staff.create({
                        data: {
                            name: name || username,
                            employeeId,
                            designation: role,
                            // Link to primary OPMC if provided (using first for home base)
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
                    staffId: staffId,
                    accessibleOpmcs: {
                        connect: opmcIds && Array.isArray(opmcIds)
                            ? opmcIds.map((id: string) => ({ id }))
                            : []
                    }
                },
                include: {
                    accessibleOpmcs: { select: { rtom: true } }
                }
            });
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
        const body = await request.json();
        const { id, username, email, password, name, role, employeeId, opmcIds } = body;

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
                    staffId,
                    accessibleOpmcs: {
                        set: [], // Clear existing
                        connect: opmcIds ? opmcIds.map((oid: string) => ({ id: oid })) : []
                    }
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
