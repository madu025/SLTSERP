export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserService } from '@/services/hr/user.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
});

export const POST = apiHandler(async (_req, _params, data: z.infer<typeof loginSchema>) => {
    try {
        const { token, user } = await UserService.login({ username: data.username, password: data.password });

        const cookieStore = await cookies();

        cookieStore.set('token', token, {
            httpOnly: true,
            // HTTPS-only in production; local dev still serves over plain HTTP
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return NextResponse.json({
            message: 'Login successful',
            user,
            token,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'INVALID_CREDENTIALS') {
            throw AppError.unauthorized('Invalid credentials');
        }

        throw error;
    }
}, { schema: loginSchema, rawResponse: true, rateLimit: { max: 10, windowSecs: 60 } });
