import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';

/**
 * A project voucher follows its project's access rules. A vendor payment has no project, so it is company-wide:
 * only users with company-wide finance access (no OPMC restriction) may see or act on it.
 */
export async function assertVoucherAccess(projectId: string | null | undefined, userId: string | null | undefined): Promise<void> {
    if (projectId) {
        await assertProjectAccess(projectId, userId);
        return;
    }
    if (await resolveOpmcScope(userId) !== undefined) {
        throw AppError.forbidden('Vendor payments need company-wide finance access');
    }
}
