export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const POST = apiHandler(async () => {
    const cookieStore = await cookies();

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 0, // Expire immediately
        path: '/',
    };

    // Clear the access token cookie
    cookieStore.set('token', '', cookieOptions);
    // Clear the refresh token cookie
    cookieStore.set('refresh_token', '', cookieOptions);

    return NextResponse.json({
        success: true,
        message: 'Logged out successfully'
    });
});
