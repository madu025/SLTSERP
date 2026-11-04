/**
 * Project status was written by many services (survey, BOQ, PAT...) while the workflow engine tracked the real
 * position separately, so dashboards that read `status` disagreed with the stage tracker. Starting a stage now
 * moves the project to the status that describes that stage; the stage stays the source of truth.
 */
export type StageDrivenStatus =
    | 'PLANNING' | 'SURVEY_IN_PROGRESS' | 'SURVEY_COMPLETE' | 'BOQ_PENDING' | 'BOQ_APPROVED'
    | 'IN_PROGRESS' | 'PRE_PAT_PASSED' | 'SLT_PAT_PASSED';

const BY_CODE: Record<string, StageDrivenStatus> = {
    REQUIREMENTS_EVALUATION: 'PLANNING',
    SURVEY_PLAN: 'SURVEY_IN_PROGRESS',
    DESIGN_PLAN: 'SURVEY_COMPLETE',
    DESIGN_REVIEW: 'SURVEY_COMPLETE',
    CAD_DRAWING: 'SURVEY_COMPLETE',
    CAD_REVIEW: 'SURVEY_COMPLETE',
    BOQ_PREPARATION: 'SURVEY_COMPLETE',
    BOQ_APPROVAL: 'BOQ_PENDING',
    CHILD_TASK_ALLOCATION: 'BOQ_APPROVED',
    PERMIT_ACCESS: 'BOQ_APPROVED',
    IMPLEMENTATION: 'IN_PROGRESS',
    INHOUSE_PAT: 'IN_PROGRESS',
    SLT_PAT: 'PRE_PAT_PASSED',
    AS_BUILT: 'SLT_PAT_PASSED',
    INVOICE_SUBMISSION: 'SLT_PAT_PASSED',
    INVOICE_FOLLOW_UP: 'SLT_PAT_PASSED',
    PROJECT_CLOSURE: 'SLT_PAT_PASSED',
};

/** Statuses a stage change must never overwrite: closed, cancelled, or deliberately held/flagged by a person. */
export const STATUS_NOT_STAGE_DRIVEN = ['COMPLETED', 'CANCELLED', 'ON_HOLD', 'DELAYED'] as const;

export function statusForStage(code: string | null | undefined, name?: string | null): StageDrivenStatus | null {
    if (code && BY_CODE[code]) return BY_CODE[code];
    // Templates without stage codes (SSD, cluster, GIS-generated): fall back to the stage name.
    const n = (name ?? '').toLowerCase();
    if (!n) return null;
    if (/survey|feasib/.test(n)) return 'SURVEY_IN_PROGRESS';
    if (/design|engineering|cad/.test(n)) return 'SURVEY_COMPLETE';
    if (/permit|access|material|procure/.test(n)) return 'BOQ_APPROVED';
    if (/install|civil|splic|cabling|otdr|test|\bqa\b|commission/.test(n)) return 'IN_PROGRESS';
    if (/handover|closure/.test(n)) return 'SLT_PAT_PASSED';
    return null;
}
