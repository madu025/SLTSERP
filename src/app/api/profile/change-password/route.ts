import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, currentPassword, newPassword } = body;

        if (!userId || !currentPassword || !newPassword) {
            return NextResponse.json(
                { message: 'All fields are required' },
                { status: 400 }
            );
        }

        await UserService.changePassword(userId, currentPassword, newPassword);

        return NextResponse.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error: unknown) {
        console.error('Password change error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PASSWORD_TOO_SHORT') {
            return NextResponse.json(
                { message: 'New password must be at least 6 characters' },
                { status: 400 }
            );
        }
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (errorMsg === 'INCORRECT_PASSWORD') {
            return NextResponse.json(
                { message: 'Current password is incorrect' },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { message: 'Error changing password' },
            { status: 500 }
        );
    }
}
