export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/hr/user.service';
import { z } from 'zod';
import { passwordProblem } from '@/config/user-admin';

const resetSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().superRefine((v, ctx) => { const p = passwordProblem(v); if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: p }); })
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { token, newPassword } = resetSchema.parse(body);

    await UserService.forgotPasswordReset(token, newPassword);

    return Response.json({
        message: 'Password reset successful'
    });
}, {
    // Public route, no roles required
rateLimit: { max: 10, windowSecs: 60 }, publicRoute: true });
