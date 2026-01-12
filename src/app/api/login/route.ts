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
        const isProduction = process.env.NODE_ENV === 'production';

        cookieStore.set('token', token, {
            httpOnly: true,
            secure: isProduction, // Still keep secure in production (HTTPS)
            sameSite: 'lax',      // Changed from 'strict' to 'lax' for better proxy support
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return NextResponse.json({
            message: 'Login successful',
            user,
        });

    } catch (error: any) {
        // Handle known errors from Service
        if (error.message === 'USERNAME_PASSWORD_REQUIRED') {
            return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
        }
        if (error.message === 'INVALID_CREDENTIALS') {
            return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }

        console.error('CRITICAL LOGIN ERROR:', error);
        return NextResponse.json(
            { message: 'Internal server error', debug: error.message },
            { status: 500 }
        );
    }
}
