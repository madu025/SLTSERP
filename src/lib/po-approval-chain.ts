/**
 * The purchase order log vocabulary. Purchase orders are approved in the HO system (owner, 26 Nov 2026: approvals such as the CEO's and
 * the three-step PO chain belong to the main HO ERP). Nexus records the approved order with its payment terms; every event on an order
 * is written to its append-only, hash-chained log (the hash lives in po-approval-hash.ts, which is server only).
 */
export const PO_APPROVAL_ACTIONS = ['SUBMITTED', 'APPROVED', 'RETURNED', 'RESET', 'CANCELLED', 'RECORDED', 'HO_PAYMENT'] as const;
export type PoApprovalAction = (typeof PO_APPROVAL_ACTIONS)[number];

/** Labels of the steps of the former Nexus chain, kept only to read the logs of orders approved before 26 Nov 2026. */
export const PO_HISTORY_STAGE_LABEL: Record<string, string> = { L1: 'Step 1: OSP Manager', L2: 'Step 2: Head of OSP', L3: 'Step 3: Finance Manager (HO)' };
