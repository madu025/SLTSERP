/**
 * SOD status writer - the single door for every status mutation.
 *
 * Why one door (measured production, 2026-09-05): four independent writers touched
 * `status` / `sltsStatus` - the live-worklist sweep, the completed-feed, the terminal self-heal
 * and the lifecycle service - each applying its own partial rule set. Two of them disagreed on
 * every tick and the SOD oscillated (defect O1), which inflated ServiceOrderStatusHistory (O3,
 * the Daily Operational Report counts that table) and produced 1,910 completion notifications for
 * 91 SODs in four hours (O2). The other defects this file closes by construction: O6 (a gate
 * verdict silently stripped fields), O8 (no-op writes still bumped updatedAt).
 *
 * Ownership, so the field set is never ambiguous:
 *  - `sltsStatus`, `status`, `completedDate`, `returnReason`, `statusDate` are written here and
 *    nowhere else. Everything else (team, contractor, materials, PAT columns) stays with callers.
 *  - The policy verdict comes from `decideStatusWrite`; this file adds no rules of its own.
 *  - History rows and the `sod.status_changed` event are emitted through
 *    `SODLifecycleService.handlePostUpdate`, which already carries the duplicate suppression.
 *  - The human-evidence process gate is evaluated here, once, and deliberately NOT run for sync
 *    actors: portal writes have no approver in the loop, and gating them loses the portal truth
 *    twice over (O4). Humans keep calling `ServiceOrderService.updateServiceOrder`, which now
 *    delegates its status columns to this function instead of writing them itself.
 */

import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { primaryClient } from '@/lib/prisma';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';
import type { UUID } from '@/types/common';
import { AppError } from '@/lib/error';
import {
    SodStatus,
    SOD_SLTS_TERMINAL_STATUSES,
    SOD_STALE_ACTIVE_STATUSES,
} from '@/lib/constants/sod-constants';
import {
    evaluateStatusWrite,
    type StatusWriteDecision,
    type SyncActor,
} from '@/lib/constants/sod-status-policy';
import { isValidUuid } from '@/lib/uuid';
import { SOD_GATE_ENTITY_TYPE } from './types';
import { SODLifecycleService } from '../sod.lifecycle.service';

/** The columns this writer owns. A caller may only express intent through these. */
export interface StatusWriteIntent {
    sltsStatus?: string | null;
    status?: string | null;
    /** Dates arrive as Date or ISO string depending on caller (feed vs prepared update payload). */
    completedDate?: Date | string | null;
    returnReason?: string | null;
}

export interface StatusWriteResult {
    /** True only when a DB write actually happened. */
    readonly changed: boolean;
    readonly decision: StatusWriteDecision;
    /**
     * The policy said no, in either mode. This is what the `blockedByPolicy` census counts, because
     * a refusal that enforce mode executed is exactly as informative as one logonly mode logged.
     */
    readonly refusedByPolicy: boolean;
    /** True only in logonly mode: the policy said no and the write went ahead anyway. */
    readonly wouldHaveBlocked: boolean;
    readonly sodId: UUID;
    readonly soNum: string;
    /**
     * The stored status view before this write, present when `changed`. A caller that runs its own
     * `handlePostUpdate` after this one (the human update facade) must pass it as the "old" view,
     * otherwise the same transition is announced twice and completion notifications double (O2).
     */
    readonly previous?: { status: string | null; sltsStatus: string | null; statusDate: Date | null };
}

const MINIMAL_SOD_SELECT = {
    id: true,
    soNum: true,
    opmcId: true,
    status: true,
    sltsStatus: true,
    statusDate: true,
    completedDate: true,
    returnReason: true,
} as const;

/** The columns this writer reasons about, as stored. */
interface StatusRow {
    id: UUID;
    soNum: string;
    opmcId: UUID;
    status: string | null;
    sltsStatus: string | null;
    statusDate: Date | null;
    completedDate: Date | null;
    returnReason: string | null;
}

/**
 * The writer's two database calls, described structurally.
 *
 * `tx ?? primaryClient` produces a union of Prisma's transaction delegate and the extended client,
 * which TypeScript cannot reconcile (TS2321/TS2349 on the call). The project rule for this is to
 * address the primary client directly for writes; the narrow interface below is that rule made
 * type-safe, and it keeps the writer usable inside a caller's transaction when it is handed one.
 */
interface StatusWriteClient {
    serviceOrder: {
        findUnique(args: { where: { id: string }, select: typeof MINIMAL_SOD_SELECT }): Promise<StatusRow | null>;
        update(args: { where: { id: string }, data: Prisma.ServiceOrderUncheckedUpdateInput }): Promise<StatusRow>;
    };
}

/** Audit marker for the event payload / history author. Humans keep their own id. */
function auditMarker(actor: SyncActor, actorUserId?: string): string {
    if (actor === 'USER' || actor === 'API') return actorUserId || actor;
    if (actor === 'AUTO_COMPLETE') return 'SYSTEM_AUTO_COMPLETE';
    return 'SYNC_SERVICE';
}

const asDate = (v: unknown): Date | null => {
    if (!v) return null;
    return v instanceof Date ? v : new Date(String(v));
};

/** Epoch millis for a possibly-null date, so Date compares are by value not by object identity. */
const asTime = (v: Date | null | undefined): number | null => (v ? v.getTime() : null);

/**
 * Remove a field the row already holds. Values arrive as `Date | string | null` from feeds and as
 * plain strings from prepared payloads, so each side is normalised before it is compared.
 */
function dropUnchanged(data: Prisma.ServiceOrderUncheckedUpdateInput, field: 'sltsStatus' | 'status' | 'completedDate' | 'returnReason' | 'statusDate', stored: unknown): void {
    const wanted = (data as Record<string, unknown>)[field];
    if (wanted === undefined) return;

    const same = isDateColumn(field)
        ? asTime(asDate(wanted)) === asTime(asDate(stored))
        : (wanted ?? null) === (stored ?? null);

    if (same) delete (data as Record<string, unknown>)[field];
}

const isDateColumn = (field: string): boolean => field === 'completedDate' || field === 'statusDate';

/**
 * Apply one status write. Pure of business rules (see sod-status-policy.ts); this function only
 * sequences: read, decide, diff, write, record.
 */
export async function applySodStatus(input: {
    sodId: UUID;
    soNum: string;
    opmcId: UUID;
    next: StatusWriteIntent;
    /** Portal CON_STATUS_DATE (or the ERP instant for non-portal actors). */
    anchor: Date | string | null;
    actor: SyncActor;
    /** Free-text why, logged and carried on the event. Never parsed. */
    reason: string;
    actorUserId?: string;
    /**
     * Payload the human-evidence gate evaluates its rule conditions against. The writer only owns the
     * status columns, so it cannot judge `totalValue`-style conditions from `next` alone; callers that
     * gate pass their full update object.
     */
    gatePayload?: Record<string, unknown>;
    /**
     * Set by a caller that already satisfied the human-evidence requirement - the approved process
     * gate whose domain action applies this status. `startGate` creates an instance with no
     * idempotency guard, so re-entering it for a transition that just cleared would open a second
     * approval on top of the write that the first approval authorised.
     */
    skipGate?: boolean;
    tx?: TransactionClient;
}): Promise<StatusWriteResult> {
    const { sodId, soNum, opmcId, next, anchor, actor, reason, actorUserId, gatePayload, skipGate, tx } = input;
    const db = (tx ?? primaryClient) as unknown as StatusWriteClient;

    const stored = await db.serviceOrder.findUnique({ where: { id: sodId }, select: MINIMAL_SOD_SELECT });
    if (!stored) {
        throw AppError.notFound(`Service order ${soNum} not found for status write (${reason})`);
    }
    if (stored.opmcId !== opmcId) {
        // Every caller resolves the OPMC from the row or from its own OPMC-scoped query, so a
        // mismatch means one of them is holding a stale id. Warn rather than throw: refusing a portal
        // write because of a bookkeeping difference is how rows get stuck.
        console.warn(`[SOD-WRITER] ${soNum}: caller claims opmcId=${opmcId}, stored row is opmcId=${stored.opmcId} (${reason}, actor=${actor})`);
    }

    const incoming = (next.sltsStatus ?? null) as string | null;
    const isTerminalIncoming = !!incoming && (SOD_SLTS_TERMINAL_STATUSES as readonly string[]).includes(incoming);
    const storedDate = asDate(stored.completedDate);
    const anchorDate = asDate(anchor);
    const requestedCompleted = next.completedDate === undefined ? undefined : asDate(next.completedDate);

    // The completion date is part of the identity of a completion write: a row that is already
    // COMPLETED but has no completedDate must still be written, so it forces the transition.
    const wantsCompletedDate = isTerminalIncoming && !(asTime(storedDate) !== null && asTime(requestedCompleted) === asTime(storedDate));
    const forcesChange = wantsCompletedDate
        || (next.returnReason !== undefined && next.returnReason !== stored.returnReason);

    const { decision, proceed, refused, wouldHaveBlocked } = evaluateStatusWrite({
        current: stored.sltsStatus,
        incoming,
        incomingAnchor: anchorDate,
        storedAnchor: asDate(stored.statusDate),
        actor,
        forcesChange,
    });

    // Whether the portal instant behind this write is a genuinely new anchor. Second granularity:
    // CON_STATUS_DATE has no sub-second precision and Prisma round-trips milliseconds.
    const storedAnchor = asDate(stored.statusDate);
    const anchorMoved = anchorDate !== null && (storedAnchor === null || Math.abs(storedAnchor.getTime() - anchorDate.getTime()) >= 1000);

    if (!proceed) {
        // A refused transition must not move the anchor forward - that is what later staleness
        // checks compare against. The one exception is a plain NO_CHANGE where the portal re-touched
        // the same status: recording that touch keeps the anchor honest, and because no status column
        // moves it produces neither a history row nor an event.
        if (decision.reason === 'NO_CHANGE' && anchorMoved) {
            await db.serviceOrder.update({ where: { id: sodId }, data: { statusDate: anchorDate } });
        }
        return { changed: false, decision, refusedByPolicy: refused, wouldHaveBlocked, sodId, soNum };
    }

    // ── Human-evidence gate (defects O4, O5, O6) ──
    // The gate exists for a person who owes the ERP field photos or a PAT acceptance. It runs here
    // and nowhere else, is addressed by (entityType, fromStatus, toStatus) so an ASSIGNED ->
    // COMPLETED move cannot inherit the ASSIGNED -> INPROGRESS photo rule, and a GATE_STARTED
    // verdict refuses the status write instead of silently deleting columns from the caller's
    // payload. Portal feeds have no approver in the loop and are excluded by design; that also keeps
    // the 2026-08-10 lock (18 SODs stuck at ASSIGNED) from ever coming back.
    const isSystemMarker = typeof actorUserId === 'string' && actorUserId.length > 0 && !isValidUuid(actorUserId);
    const gateApplies = !skipGate && !isSystemMarker && (actor === 'USER' || actor === 'API');
    if (gateApplies && incoming && incoming !== stored.sltsStatus) {
        const { ProcessGateEngine } = await import('@/services/approval/process-gate-engine');
        const gate = await ProcessGateEngine.startGate({
            entityType: SOD_GATE_ENTITY_TYPE,
            entityId: sodId,
            currentStatus: stored.sltsStatus as string,
            toStatus: incoming,
            entityPayload: gatePayload ?? { ...next },
            makerId: isValidUuid(actorUserId) ? actorUserId : undefined,
        });
        if (gate.status === 'GATE_STARTED') {
            console.log(`[SOD-WRITER] ${soNum}: ${stored.sltsStatus} -> ${incoming} held by gate policy ${gate.policyId} (approval ${gate.instanceId})`);
            return { changed: false, decision: { allow: false, reason: 'GATE_PENDING' }, refusedByPolicy: false, wouldHaveBlocked: false, sodId, soNum };
        }
    }

    // ── Field-set ownership ──
    const data: Prisma.ServiceOrderUncheckedUpdateInput = {};
    if (incoming) {
        data.sltsStatus = incoming as ServiceOrderStatus;

        // Mirror rule (single copy, previously duplicated in prepareStatusTransition): a terminal
        // portal status also advances the ERP workflow status, because the DB invariant trigger and
        // every pending-table query require the two columns to agree.
        if (isTerminalIncoming) {
            data.status = incoming as ServiceOrderStatus;
        } else if (
            next.status === undefined
            && (SOD_STALE_ACTIVE_STATUSES as readonly string[]).includes(incoming)
            && !!stored.status
            && (SOD_SLTS_TERMINAL_STATUSES as readonly string[]).includes(stored.status)
        ) {
            // An explicit reopen of a workflow-terminal row must not leave `status` closed.
            data.status = incoming as ServiceOrderStatus;
        }
    }
    if (next.status !== undefined && next.status) data.status = next.status as ServiceOrderStatus;

    if (isTerminalIncoming) {
        const completed = requestedCompleted ?? anchorDate ?? storedDate ?? new Date();
        if (asTime(storedDate) !== asTime(completed)) data.completedDate = completed;
    } else if (incoming === SodStatus.RETURN) {
        // A returned connection did not complete: stale completion data would be billed.
        if (storedDate) data.completedDate = null;
    } else if (requestedCompleted !== undefined && asTime(requestedCompleted) !== asTime(storedDate)) {
        data.completedDate = requestedCompleted;
    }

    if (next.returnReason !== undefined) data.returnReason = next.returnReason;
    if (anchorMoved) data.statusDate = anchorDate;

    // ── No-op guard (O8): the write must change at least one stored column. ──
    // The comparison has to be by value, not by key presence: a replaying feed supplies every column
    // it knows about whether or not they moved, and `update({ returnReason: <same value> })` still
    // re-stamps updatedAt, which is the noise this path exists to suppress.
    dropUnchanged(data, 'sltsStatus', stored.sltsStatus);
    dropUnchanged(data, 'status', stored.status);
    dropUnchanged(data, 'completedDate', stored.completedDate);
    dropUnchanged(data, 'returnReason', stored.returnReason);
    dropUnchanged(data, 'statusDate', stored.statusDate);

    if (Object.keys(data).length === 0) {
        // Reachable when a caller expresses only fields that already hold those values (a replaying
        // feed with a fresh completedDate equal to the stored one). Bumping updatedAt for that is the
        // noise that inflated the Daily Report and re-triggered listeners.
        return {
            changed: false,
            decision: { allow: false, reason: 'NO_CHANGE' },
            refusedByPolicy: false,
            wouldHaveBlocked: false,
            sodId,
            soNum,
        };
    }

    const updated = await db.serviceOrder.update({ where: { id: sodId }, data });

    const previous = { status: stored.status, sltsStatus: stored.sltsStatus, statusDate: asDate(stored.statusDate) };

    // History + event, with duplicate suppression inside. The old view is what makes the
    // transition legible to the report and to the notification policy.
    await SODLifecycleService.handlePostUpdate(
        previous,
        {
            id: updated.id,
            status: updated.status as string,
            sltsStatus: updated.sltsStatus as string,
            opmcId: updated.opmcId as UUID,
            soNum: updated.soNum as string,
            returnReason: updated.returnReason as string | null,
        },
        data,
        auditMarker(actor, actorUserId),
        tx,
        actor,
    );

    console.log(`[SOD-WRITER] ${soNum}: ${stored.sltsStatus || '-'} -> ${incoming || stored.sltsStatus} (${reason}, actor=${actor}${wouldHaveBlocked ? ', LOGONLY: policy would block' : ''})`);

    return { changed: true, decision, refusedByPolicy: refused, wouldHaveBlocked, sodId, soNum, previous };
}

/** Tally helper for SyncRun.decisions. */
export function countDecision(
    tally: Record<string, number>,
    decision: StatusWriteDecision,
    blockedWouldBe = false,
): Record<string, number> {
    const key = blockedWouldBe && decision.reason !== 'APPLIED' ? `${decision.reason}_WOULD_BLOCK` : decision.reason;
    tally[key] = (tally[key] || 0) + 1;
    return tally;
}
