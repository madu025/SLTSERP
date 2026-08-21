export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const POST = apiHandler(async () => {
    const cookieStore = await cookies();

    // Clear the token cookie
    cookieStore.set('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        path: '/',
    });

    return NextResponse.json({
        success: true,
        message: 'Logged out successfully'
    });
});
