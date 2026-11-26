import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

/**
 * The purchase order approval chain. Three steps, always all three, in this order. Each step is a capability of its own, so who
 * holds a step is decided by the role grants in the database and never by a role name here. Pure and client-safe (the hash of the log lives in po-approval-hash.ts, which is server only).
 *
 *   Procurement Officer raises the order  ->  step 1  ->  step 2  ->  step 3  ->  APPROVED
 *   A return (reject, with remarks) moves the order one step back; from step 1 it goes back to the person who raised it (RETURNED).
 */
export const PO_STAGES = ['L1', 'L2', 'L3'] as const;
export type PoStage = (typeof PO_STAGES)[number];

export const PO_STAGE_PERMISSION: Record<PoStage, string> = {
    L1: RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L1,
    L2: RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L2,
    L3: RBAC_PERMISSIONS.PROCUREMENT_PO_APPROVE_L3,
};

/** What the screens call a step (the capability decides who may act; this is only the label). */
export const PO_STAGE_LABEL: Record<PoStage, string> = { L1: 'Step 1: OSP Manager', L2: 'Step 2: Head of OSP', L3: 'Step 3: Finance Manager (HO)' };

export function isPoStage(value: unknown): value is PoStage {
    return (PO_STAGES as readonly string[]).includes(String(value));
}

export const FIRST_PO_STAGE: PoStage = 'L1';

/** The step after this one; null when this was the last (the order is then approved). */
export function nextStage(stage: PoStage): PoStage | null {
    const i = PO_STAGES.indexOf(stage);
    return i >= 0 && i < PO_STAGES.length - 1 ? PO_STAGES[i + 1] : null;
}

/** The step a return goes to: one step back; null from step 1 (the order goes back to the person who raised it). */
export function previousStage(stage: PoStage): PoStage | null {
    const i = PO_STAGES.indexOf(stage);
    return i > 0 ? PO_STAGES[i - 1] : null;
}

export const PO_APPROVAL_ACTIONS = ['SUBMITTED', 'APPROVED', 'RETURNED', 'RESET', 'CANCELLED', 'RECORDED', 'HO_PAYMENT'] as const;
export type PoApprovalAction = (typeof PO_APPROVAL_ACTIONS)[number];

/** Remarks are required whenever the chain does not move forward: a return, a cancellation and a reset. */
export function remarksRequired(action: PoApprovalAction): boolean {
    return action === 'RETURNED' || action === 'CANCELLED' || action === 'RESET';
}

/** The cleaned remarks; null when there are none, and also null when remarks are required but too short (callers refuse a null). */
export function assertRemarks(action: PoApprovalAction, remarks: string | null | undefined): string | null {
    const text = (remarks ?? '').trim();
    if (remarksRequired(action) && text.length < 3) return null;
    return text || null;
}

// ---- HO mode: the order is approved in the HO system and recorded in Nexus with its evidence ----------------------------

export const PO_APPROVAL_MODE_KEY = 'PROCUREMENT_PO_APPROVAL_MODE';
export type PoApprovalMode = 'HO_DOCUMENTS' | 'NEXUS_CHAIN';

/** HO_DOCUMENTS unless the admin chose the Nexus chain; anything unknown is read as HO_DOCUMENTS (the default). */
export function poApprovalMode(value: string | null | undefined): PoApprovalMode {
    return value === 'NEXUS_CHAIN' ? 'NEXUS_CHAIN' : 'HO_DOCUMENTS';
}

/** What recording (or re-recording) the HO payment clears: the received value not yet cleared. Never negative. */
export function hoClearingDelta(receivedValue: number, alreadyCleared: number): number {
    return Math.max(0, Math.round((receivedValue - alreadyCleared) * 100) / 100);
}

// ---- the supplier payment threshold -------------------------------------------------------------------------------------

/** Default only; the live value is the admin setting PROCUREMENT_CEO_APPROVAL_THRESHOLD. */
export const DEFAULT_EXECUTIVE_PAYMENT_THRESHOLD = 5_000_000;
export const EXECUTIVE_THRESHOLD_KEY = 'PROCUREMENT_CEO_APPROVAL_THRESHOLD';

/** A supplier invoice above the threshold needs a second approval by the executive after the finance approval. */
export function needsExecutiveApproval(invoiceTotal: number, threshold: number): boolean {
    return Number.isFinite(threshold) && threshold >= 0 && invoiceTotal > threshold;
}
