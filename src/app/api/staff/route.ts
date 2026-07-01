import { NextResponse } from 'next/server';
import { StaffService } from '@/services/staff.service';

// GET all staff with hierarchy info and linked users
export async function GET() {
    try {
        const staff = await StaffService.getStaff();
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
        const staff = await StaffService.createStaff(body);
        return NextResponse.json(staff);
    } catch (error: any) {
        console.error('Staff Creation Error:', error);
        if (error.code === 'P2002') {
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
        const { id, ...updateFields } = body;

        const updatedStaff = await StaffService.updateStaff(id, updateFields);
        return NextResponse.json(updatedStaff);
    } catch (error: any) {
        console.error('Staff Update Error:', error);
        if (error.message === 'CANNOT_REPORT_TO_SELF') {
            return NextResponse.json({ message: 'Cannot report to self' }, { status: 400 });
        }
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

        await StaffService.deleteStaff(id);
        return NextResponse.json({ message: 'Staff deleted successfully' });
    } catch (error: any) {
        console.error('Staff Deletion Error:', error);
        const msg = error.message;
        if (msg && msg.startsWith('HAS_SUBORDINATES_')) {
            const count = msg.replace('HAS_SUBORDINATES_', '');
            return NextResponse.json({
                message: `Cannot delete staff member with ${count} subordinates. Reassign them first.`
            }, { status: 400 });
        }
        if (msg === 'HAS_LINKED_USER') {
            return NextResponse.json({
                message: 'Cannot delete staff with linked user. Unlink the user first.'
            }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error deleting staff' }, { status: 500 });
    }
}
