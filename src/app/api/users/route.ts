import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

// GET all users
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Security Check: Role Based Access Control
        const role = request.headers.get('x-user-role');

        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const result = await UserService.getUsers(page, limit);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Error fetching users:', error);
        const details = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ message: 'Error fetching users', details }, { status: 500 });
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
        const currentUserId = request.headers.get('x-user-id') || 'system';

        const userWithoutPassword = await UserService.createUser(body, currentUserId);
        return NextResponse.json(userWithoutPassword);
    } catch (error: unknown) {
        console.error('Registration Error:', error);
        const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined;
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorCode === 'P2002') {
            return NextResponse.json({ message: 'Username, Email, or Employee ID already exists' }, { status: 400 });
        }
        if (errorMsg === 'OPMC_REQUIRED') {
            return NextResponse.json({
                message: 'OPMC selection is required for New Connection and Service Assurance roles'
            }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating user', debug: errorMsg }, { status: 500 });
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
        const { id } = body;
        const currentUserId = request.headers.get('x-user-id') || 'system';

        const userWithoutPassword = await UserService.updateUser(id, body, currentUserId);
        return NextResponse.json(userWithoutPassword);
    } catch (error: unknown) {
        console.error('Update Error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (errorMsg === 'CANNOT_DEMOTE_SUPER_ADMIN') {
            return NextResponse.json({ message: 'Cannot demote Super Admin' }, { status: 403 });
        }
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

        await UserService.deleteUser(id);
        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (errorMsg === 'CANNOT_DELETE_SUPER_ADMIN') {
            return NextResponse.json({ message: 'Cannot delete Super Admin' }, { status: 403 });
        }
        return NextResponse.json({ message: 'Error deleting user' }, { status: 500 });
    }
}
