import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all staff with hierarchy info and linked users
export async function GET() {
    try {
        const staff = await prisma.staff.findMany({
            select: {
                id: true,
                name: true,
                employeeId: true,
                designation: true,
                reportsToId: true,
                opmcId: true,
                opmc: { select: { code: true, name: true } },
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        role: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(staff);
    } catch (error) {
        return NextResponse.json({ message: 'Error fetching staff' }, { status: 500 });
    }
}

// POST create new staff member
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, employeeId, designation, reportsToId, opmcId, userId } = body;

        const staff = await prisma.staff.create({
            data: {
                name,
                employeeId,
                designation,
                reportsToId: reportsToId || null,
                opmcId: opmcId || null
            }
        });

        // If userId provided, link user to this staff
        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { staffId: staff.id }
            });
        }

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Staff Creation Error:', error);
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ message: 'Employee ID already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating staff' }, { status: 500 });
    }
}

// PUT to update staff details, hierarchy, or user assignment
export async function PUT(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { id, name, designation, reportsToId, opmcId, userId } = body;

        // Validation for circular dependency
        if (id === reportsToId) {
            return NextResponse.json({ message: 'Cannot report to self' }, { status: 400 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (designation !== undefined) updateData.designation = designation;
        if (reportsToId !== undefined) updateData.reportsToId = reportsToId;
        if (opmcId !== undefined) updateData.opmcId = opmcId;

        const updatedStaff = await prisma.staff.update({
            where: { id },
            data: updateData
        });

        // Handle user assignment/unassignment
        if (userId !== undefined) {
            if (userId === null) {
                // Unlink any user from this staff
                await prisma.user.updateMany({
                    where: { staffId: id },
                    data: { staffId: null }
                });
            } else {
                // Link user to this staff
                await prisma.user.update({
                    where: { id: userId },
                    data: { staffId: id }
                });
            }
        }

        return NextResponse.json(updatedStaff);
    } catch (error) {
        console.error('Staff Update Error:', error);
        return NextResponse.json({ message: 'Error updating staff' }, { status: 500 });
    }
}

// DELETE staff member
export async function DELETE(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Only Super Admin can delete Staff' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ message: 'Staff ID required' }, { status: 400 });
        }

        // Check if staff has subordinates
        const subordinates = await prisma.staff.count({
            where: { reportsToId: id }
        });

        if (subordinates > 0) {
            return NextResponse.json({
                message: `Cannot delete staff member with ${subordinates} subordinates. Reassign them first.`
            }, { status: 400 });
        }

        // Check if staff has linked user
        const linkedUser = await prisma.user.findFirst({
            where: { staffId: id }
        });

        if (linkedUser) {
            return NextResponse.json({
                message: 'Cannot delete staff with linked user. Unlink the user first.'
            }, { status: 400 });
        }

        await prisma.staff.delete({ where: { id } });
        return NextResponse.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting staff' }, { status: 500 });
    }
}
