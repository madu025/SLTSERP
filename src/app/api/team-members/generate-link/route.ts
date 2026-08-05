export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { TeamMemberService } from '@/services/hr/team-member.service';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const POST = apiHandler(async (_request, _params, body) => {
    const memberId = body.memberId as string | undefined;

    if (!memberId) {
        throw AppError.badRequest('Member ID is required');
    }

    const link = await TeamMemberService.generateUploadLink(memberId);
    return { link };
}, {
    roles: ROLE_GROUPS.OFFICE_ADMINS,
    audit: { action: 'GENERATE_LINK', entity: 'TeamMember' },
    rawResponse: true
});
