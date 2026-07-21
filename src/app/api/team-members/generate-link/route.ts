import { apiHandler } from '@/lib/api-handler';
import { TeamMemberService } from '@/services/team-member.service';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const { memberId } = body || {};

    if (!memberId) {
        throw AppError.badRequest('Member ID is required');
    }

    const link = await TeamMemberService.generateUploadLink(memberId);
    return { link };
}, {
    audit: { action: 'GENERATE_LINK', entity: 'TeamMember' },
    rawResponse: true
});
