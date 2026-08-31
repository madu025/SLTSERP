export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { NextResponse } from 'next/server';
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
        const cookieOptions = {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax' as const,
            path: '/',
        };

        const response = NextResponse.json({
            message: 'Login successful',
            user,
            token,
            refreshToken,
        });

        // Set access token cookie (15 min expiry, httpOnly)
        const accessCookie = `token=${token}; Max-Age=900; Path=${cookieOptions.path}; SameSite=${cookieOptions.sameSite}${cookieOptions.secure ? '; Secure' : ''}${cookieOptions.httpOnly ? '; HttpOnly' : ''}`;
        response.headers.set('Set-Cookie', accessCookie);

        // Set refresh token cookie (7 day expiry, httpOnly)
        const refreshCookie = `refresh_token=${refreshToken}; Max-Age=604800; Path=${cookieOptions.path}; SameSite=${cookieOptions.sameSite}${cookieOptions.secure ? '; Secure' : ''}; HttpOnly`;
        response.headers.append('Set-Cookie', refreshCookie);

        console.log(`[LOGIN] Response ready in ${Date.now() - loginStart}ms, Set-Cookie headers present: ${response.headers.has('Set-Cookie')}`);
        return response;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[LOGIN] AuthService failed in ${Date.now() - loginStart}ms: ${errorMessage}`);

        if (errorMessage === 'INVALID_CREDENTIALS') {
            throw AppError.unauthorized('Invalid credentials');
        }

        throw error;
    }
}, { schema: loginSchema, rawResponse: true, rateLimit: { max: 10, windowSecs: 60 } });
