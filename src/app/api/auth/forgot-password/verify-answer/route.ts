import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function POST(request: Request) {
    try {
        const { token, answer } = await request.json();

        if (!token || !answer) {
            return NextResponse.json(
                { message: 'Token and answer are required' },
                { status: 400 }
            );
        }

        const result = await UserService.forgotPasswordVerifyAnswer(token, answer);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Verify answer error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVALID_TOKEN') {
            return NextResponse.json(
                { message: 'Invalid or expired token' },
                { status: 401 }
            );
        }
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (errorMsg === 'INCORRECT_ANSWER') {
            return NextResponse.json(
                { message: 'Incorrect security answer' },
                { status: 401 }
            );
        }
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
