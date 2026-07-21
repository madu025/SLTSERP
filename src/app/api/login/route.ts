import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { UserService } from '@/services/user.service';
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
            secure: false, // Set to false to allow login via HTTP (IP address/CloudFront)
            sameSite: 'lax',
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return Response.json({
            message: 'Login successful',
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
    rawResponse: true
});
