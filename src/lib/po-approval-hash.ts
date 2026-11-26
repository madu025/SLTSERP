import { createHash } from 'node:crypto';

// ---- the tamper-evident log of the chain --------------------------------------------------------------------------------

export interface PoApprovalEntry {
    purchaseOrderId: string;
    seq: number;
    stage: string | null;
    action: string;
    actorId: string;
    amount: string;
    remarks: string | null;
    createdAt: Date | string;
}

/** SHA-256 over the previous entry's hash and every field of this one, so changing or removing any earlier entry breaks all later hashes. */
export function approvalEntryHash(previousHash: string | null, e: PoApprovalEntry): string {
    const created = e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString();
    return createHash('sha256')
        .update([previousHash ?? '', e.purchaseOrderId, e.seq, e.stage ?? '', e.action, e.actorId, e.amount, e.remarks ?? '', created].join('|'))
        .digest('hex');
}

/** Verifies a PO's whole chain of entries (in sequence order). Returns the first broken sequence number, or null when intact. */
export function firstBrokenEntry(entries: (PoApprovalEntry & { previousHash: string | null; hash: string })[]): number | null {
    let prev: string | null = null;
    for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
        if ((e.previousHash ?? null) !== prev || approvalEntryHash(prev, e) !== e.hash) return e.seq;
        prev = e.hash;
    }
    return null;
}
