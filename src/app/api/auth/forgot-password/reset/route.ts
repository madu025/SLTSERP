import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function POST(request: Request) {
    try {
        const { token, newPassword } = await request.json();

        if (!token || !newPassword) {
            return NextResponse.json(
                { message: 'Token and new password are required' },
                { status: 400 }
            );
        }

        await UserService.forgotPasswordReset(token, newPassword);

        return NextResponse.json({
            message: 'Password reset successful'
        });

    } catch (error: unknown) {
        console.error('Password reset error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PASSWORD_TOO_SHORT') {
            return NextResponse.json(
                { message: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }
        if (errorMsg === 'INVALID_TOKEN') {
            return NextResponse.json(
                { message: 'Invalid or expired token' },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
