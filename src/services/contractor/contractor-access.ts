import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/**
 * Data-scope boundary for the contractor management APIs (`/api/contractors/**`).
 *
 * The `contractor.read` / `contractor.write` capabilities are also held by contractor portal accounts, so on their own
 * they say nothing about WHICH contractor may be touched. Every management endpoint that takes a contractor or a team
 * must therefore go through here:
 *  - a contractor account (a user tied to a contractor) is never allowed to manage contractors, teams or stores;
 *  - a staff account may only act on a contractor that sits inside its OPMC scope (the contractor's own OPMC or the
 *    OPMC of one of its teams, the same rule the approval flow uses); global scope (admin) passes.
 */
export class ContractorAccess {
    /** True when the account belongs to a contractor (portal user) rather than SLTS staff. */
    static async isContractorAccount(userId: string): Promise<boolean> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { contractorId: true } });
        return !!user?.contractorId;
    }

    /** Management endpoints that are not tied to one contractor (lists, invite links): staff only. */
    static async assertStaff(userId: string | null | undefined): Promise<void> {
        if (!userId) throw AppError.unauthorized('Authentication required');
        if (await this.isContractorAccount(userId)) {
            throw AppError.forbidden('CONTRACTOR_ACCOUNT_CANNOT_MANAGE_CONTRACTORS');
        }
    }

    /** Staff access to one contractor, inside the caller's OPMC scope. */
    static async assertStaffManagesContractor(userId: string | null | undefined, contractorId: string): Promise<void> {
        await this.assertStaff(userId);
        const scope = await resolveOpmcScope(userId);
        if (scope === undefined) return;
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            select: { opmcId: true, teams: { select: { opmcId: true } } },
        });
        if (!contractor) throw AppError.notFound('CONTRACTOR_NOT_FOUND');
        const opmcIds = [contractor.opmcId, ...contractor.teams.map((t) => t.opmcId)].filter((v): v is string => Boolean(v));
        if (!opmcIds.some((id) => scope.includes(id))) {
            throw AppError.forbidden('Contractor is outside the authenticated OPMC scope');
        }
    }

    /** Staff access to a team, through the contractor that owns it. */
    static async assertStaffManagesTeam(userId: string | null | undefined, teamId: string): Promise<string> {
        await this.assertStaff(userId);
        const team = await prisma.contractorTeam.findUnique({ where: { id: teamId }, select: { contractorId: true } });
        if (!team) throw AppError.notFound('TEAM_NOT_FOUND');
        await this.assertStaffManagesContractor(userId, team.contractorId);
        return team.contractorId;
    }
}
