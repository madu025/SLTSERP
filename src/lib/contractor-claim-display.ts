/**
 * How the contractor portal words an invoice claim. Pure, so the wording is testable.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The billing month of an invoice: the month it bills, not the day it was created. */
export function claimMonthLabel(invoice: { month?: number | null; year?: number | null; date?: Date | string | null }): string {
    if (invoice.month && invoice.month >= 1 && invoice.month <= 12 && invoice.year) return `${MONTHS[invoice.month - 1]} ${invoice.year}`;
    if (invoice.date) {
        const d = new Date(invoice.date);
        return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    return '';
}

/** The share of the invoice that is held back, from the amounts themselves (not a fixed 20%). */
export function retentionPercent(gross: number, retention: number): number {
    if (!(gross > 0) || !(retention > 0)) return 0;
    return Math.round((retention / gross) * 1000) / 10;
}

const STAGE_WORDS: Record<string, string> = {
    AREA_COORDINATOR: 'the Area Coordinator',
    QC_OFFICER: 'the QC Officer',
    CONTRACTOR: 'you',
    ENGINEER: 'the Area Engineer',
    AREA_MANAGER: 'the Area Manager',
};

/** The first line of the payment timeline: what the invoice is waiting for, or that it is approved. */
export function approvalLine(status: string, confirmStage?: string | null, certified = false): { title: string; detail: string } {
    if (certified) return { title: 'Audited & approved', detail: 'SF Audit certification complete' };
    if (confirmStage && STAGE_WORDS[confirmStage]) return { title: 'Area approval in progress', detail: `Waiting for ${STAGE_WORDS[confirmStage]}` };
    if (confirmStage === 'CANCELLED' || status === 'CANCELLED') return { title: 'Cancelled', detail: 'This invoice was cancelled' };
    return { title: 'Waiting for audit', detail: 'Area approvals are complete; OSP Quality and Finance are next' };
}
