import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { userHasPermission } from '@/lib/user-permissions';

/**
 * The Head Office legs of a payment voucher need their own capabilities: OSP Finance submits a voucher to Head Office,
 * Head Office confirms the payment (or sends it back). Approving a voucher in OSP is not enough to do either.
 * Returns whether the actor is an OSP user (holds the submit capability) recording a confirmation for Head Office.
 */
export async function assertHoTransition(userId: string, from: string, to: string): Promise<{ recordedOnBehalf: boolean }> {
    if (to === 'SUBMITTED_TO_HO') {
        if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_SUBMIT))) throw AppError.forbidden('finance.ho.submit is required to submit a voucher to Head Office');
        return { recordedOnBehalf: false };
    }
    const confirming = to === 'PAID' || (to === 'APPROVED' && from === 'SUBMITTED_TO_HO');
    if (!confirming) return { recordedOnBehalf: false };
    if (!(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_CONFIRM))) throw AppError.forbidden('finance.ho.confirm is required to confirm or return a Head Office payment');
    return { recordedOnBehalf: await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_HO_SUBMIT) };
}
