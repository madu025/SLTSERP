import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';

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

    return Response.json({
        success: true,
        message: 'Logged out successfully'
    });
});
