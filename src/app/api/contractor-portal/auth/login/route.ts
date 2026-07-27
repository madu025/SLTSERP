import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { UserService } from '@/services/user.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
});

export const POST = apiHandler(async (_req, _params, data: z.infer<typeof loginSchema>) => {
    try {
        const { token, user } = await UserService.login({ username: data.username, password: data.password });

        const cookieStore = await cookies();

        cookieStore.set('contractor_token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400,
            path: '/',
        });

        return Response.json({
            message: 'Contractor login successful',
            token,
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
