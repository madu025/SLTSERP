export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
});

export const POST = apiHandler(async (_req, _params, data: z.infer<typeof loginSchema>) => {
    const loginStart = Date.now();
    try {
        const { token, refreshToken, user } = await UserService.login({ username: data.username, password: data.password });
        console.log(`[LOGIN] AuthService succeeded in ${Date.now() - loginStart}ms for user: ${user.username}`);

        const isProd = process.env.NODE_ENV === 'production';

        // Use next/headers cookies() — Next.js ensures each Set-Cookie is a
        // separate header (headers.set/append merges them into one comma-
        // separated header which browsers parse incorrectly).
        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: 900, // 15 minutes
        });
        cookieStore.set('refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: 604800, // 7 days
        });

        console.log(`[LOGIN] Response ready in ${Date.now() - loginStart}ms`);
        return NextResponse.json({
            message: 'Login successful',
            user,
            token,
            refreshToken,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[LOGIN] AuthService failed in ${Date.now() - loginStart}ms: ${errorMessage}`);

        if (errorMessage === 'INVALID_CREDENTIALS') {
            throw AppError.unauthorized('Invalid credentials');
        }

        throw error;
    }
}, { schema: loginSchema, rawResponse: true, rateLimit: { max: 10, windowSecs: 60 } });
