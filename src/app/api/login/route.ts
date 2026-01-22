import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { UserService } from '@/services/user.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // Call Service
        const { token, user } = await UserService.login({ username, password });

        // Set HttpOnly Cookie
        const cookieStore = await cookies();

        cookieStore.set('token', token, {
            httpOnly: true,
            secure: false, // Set to false to allow login via HTTP (IP address/CloudFront)
            sameSite: 'lax',
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return NextResponse.json({
            message: 'Login successful',
            user,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle known errors from Service
        if (errorMessage === 'USERNAME_PASSWORD_REQUIRED') {
            return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
        }
        if (errorMessage === 'INVALID_CREDENTIALS') {
            return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }

        console.error('CRITICAL LOGIN ERROR:', error);
        return NextResponse.json(
            { message: 'Internal server error', debug: errorMessage },
            { status: 500 }
        );
    }
}
