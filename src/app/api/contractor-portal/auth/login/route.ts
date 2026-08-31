import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
});

export const POST = apiHandler(async (_req, _params, data: z.infer<typeof loginSchema>) => {
    try {
        const { token, refreshToken, user } = await UserService.login({ username: data.username, password: data.password });

        const cookieStore = await cookies();
        const isProd = process.env.NODE_ENV === 'production';

        cookieStore.set('contractor_token', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge: 900, // 15 min (access token)
            path: '/',
        });

        cookieStore.set('contractor_refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge: 604800, // 7 days (refresh token)
            path: '/',
        });

        return NextResponse.json({
            message: 'Contractor login successful',
            token,
            refreshToken,
            user,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'INVALID_CREDENTIALS') {
            throw AppError.unauthorized('Invalid credentials');
        }

        throw error;
    }
}, {
    schema: loginSchema,
    rawResponse: true, rateLimit: { max: 10, windowSecs: 60 }
});
