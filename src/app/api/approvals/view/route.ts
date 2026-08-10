import { apiHandler } from '@/lib/api-handler';
import { DynamicApprovalService } from '@/services/approval/dynamic-approval.service';
import { AppError } from '@/lib/error';
import { requireEnv } from '@/lib/env';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

interface ViewTokenPayload {
    instanceId: string;
    userId: string;
    purpose?: string;
}

/**
 * Public endpoint backing the email approval view page.
 * Validates a neutral VIEW token, returns the approval details plus fresh
 * approve/reject action tokens so the approver can review before deciding.
 */
export const GET = apiHandler(async (req: Request, params) => {
    const token = new URL(req.url).searchParams.get('token');

    if (!token) {
        throw AppError.badRequest('Missing action token.');
    }

    let decoded: ViewTokenPayload;
    try {
        decoded = jwt.verify(token, requireEnv('JWT_SECRET')) as ViewTokenPayload;
    } catch {
        throw AppError.badRequest('Invalid or expired action token.');
    }

    if (decoded.purpose !== 'VIEW' || !decoded.instanceId) {
        throw AppError.badRequest('Invalid token purpose.');
    }

    // Security: logged-in user must match the token's assigned user
    if (params._userId && params._userId !== decoded.userId) {
        throw AppError.forbidden('This approval is not assigned to you.');
    }

    const details = await DynamicApprovalService.getApprovalDetails(decoded.instanceId);

    // Issue fresh action tokens tied to the same user
    const approveToken = DynamicApprovalService.generateActionToken(decoded.instanceId, 'APPROVED', decoded.userId);
    const rejectToken = DynamicApprovalService.generateActionToken(decoded.instanceId, 'REJECTED', decoded.userId);

    return {
        details,
        approveToken,
        rejectToken
    };
}, { rawResponse: false });
