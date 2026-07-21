import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const resetSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { token, newPassword } = resetSchema.parse(body);

    await UserService.forgotPasswordReset(token, newPassword);

    return Response.json({
        message: 'Password reset successful'
    });
}, {
    // Public route, no roles required
});
