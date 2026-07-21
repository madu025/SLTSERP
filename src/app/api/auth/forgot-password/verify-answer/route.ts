import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const verifyAnswerSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    answer: z.string().min(1, 'Answer is required')
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { token, answer } = verifyAnswerSchema.parse(body);

    const result = await UserService.forgotPasswordVerifyAnswer(token, answer);
    return Response.json(result);
}, {
    // Public route, no roles required
});
