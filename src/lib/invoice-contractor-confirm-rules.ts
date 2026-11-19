/**
 * An invoice is in the OSP Quality (SF Audit) queue only once the area approval gate (which includes the contractor's own step) is done.
 * Invoices that existed before the gate count as done.
 */
export function isReadyForOspQuality(inv: { confirmStage: string; contractorConfirmStatus: string; statusA: string }): boolean {
    return inv.confirmStage === 'CONFIRMED' && inv.contractorConfirmStatus === 'CONFIRMED' && inv.statusA === 'PENDING_SF_AUDIT';
}
