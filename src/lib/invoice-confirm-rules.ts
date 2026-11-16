import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/**
 * Area confirmation chain for contractor invoices:
 * Area Coordinator -> QC Officer -> Area Engineer/Officer (only when the area has one) -> Area Manager.
 * Invoice.confirmStage is the stage the invoice is waiting at; CONFIRMED means the chain is complete.
 */
export const CONFIRM_STAGES = ['AREA_COORDINATOR', 'QC_OFFICER', 'AREA_ENGINEER', 'AREA_MANAGER'] as const;
export type ConfirmStage = (typeof CONFIRM_STAGES)[number];
export type InvoiceConfirmStage = ConfirmStage | 'CONFIRMED';

export const CONFIRM_START_STAGE: ConfirmStage = 'AREA_COORDINATOR';

export const STAGE_LABEL: Record<ConfirmStage, string> = {
    AREA_COORDINATOR: 'Area Coordinator',
    QC_OFFICER: 'QC Officer',
    AREA_ENGINEER: 'Area Engineer / Officer',
    AREA_MANAGER: 'Area Manager',
};

export const STAGE_PERMISSION: Record<ConfirmStage, string> = {
    AREA_COORDINATOR: RBAC_PERMISSIONS.INVOICE_CONFIRM_COORDINATOR,
    QC_OFFICER: RBAC_PERMISSIONS.INVOICE_CONFIRM_QC,
    AREA_ENGINEER: RBAC_PERMISSIONS.INVOICE_CONFIRM_ENGINEER,
    AREA_MANAGER: RBAC_PERMISSIONS.INVOICE_CONFIRM_MANAGER,
};

export function isConfirmStage(value: string): value is ConfirmStage {
    return (CONFIRM_STAGES as readonly string[]).includes(value);
}

/** The stage after `current`; the engineer stage is skipped when nobody holds that position in the area. */
export function nextStage(current: ConfirmStage, areaHasEngineer: boolean): InvoiceConfirmStage {
    switch (current) {
        case 'AREA_COORDINATOR': return 'QC_OFFICER';
        case 'QC_OFFICER': return areaHasEngineer ? 'AREA_ENGINEER' : 'AREA_MANAGER';
        case 'AREA_ENGINEER': return 'AREA_MANAGER';
        case 'AREA_MANAGER': return 'CONFIRMED';
    }
}

/** One person cannot confirm two different stages of the same invoice. */
export function canConfirm(
    userId: string,
    priorConfirmers: { userId: string; stage: string }[],
    stage: ConfirmStage,
): boolean {
    return !priorConfirmers.some((c) => c.userId === userId && c.stage !== stage);
}
