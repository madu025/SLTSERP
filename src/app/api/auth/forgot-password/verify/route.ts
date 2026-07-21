import { apiHandler } from '@/lib/api-handler';
import { UserService } from '@/services/user.service';
import { z } from 'zod';

const verifySchema = z.object({
    username: z.string().min(1, 'Username is required'),
    employeeId: z.string().min(1, 'Employee ID is required')
});

export const POST = apiHandler(async (_req, _params, body) => {
    const { username, employeeId } = verifySchema.parse(body);

    const result = await UserService.forgotPasswordVerify(username, employeeId);
    return Response.json(result);
}, {
    // Public route, no roles required
});
