/**
 * SOD Status Authority Policy
 *
 * Single source of truth for "may this writer move this SOD to that status?".
 *
 * Why this exists (measured in production, 2026-09-05): the per-RTOM live-worklist sweep
 * (`x=ftthpen`) keeps returning the pre-closure CON_STATUS for SODs that the completion feed has
 * already closed. The sweep wrote INPROGRESS over the closed row, the 20-minute completion pass
 * wrote COMPLETED back, and the same SOD flipped every 10 minutes - 1,910 completion notifications
 * for 91 SODs in four hours and 3,056 inflated status-history rows in one day (the Daily
 * Operational Report counts that table). Two writers each acting correctly produced an endless
 * disagreement because neither was told which one is authoritative.
 *
 * The rules, in order:
 *  1. nothing changed                                     -> NO_CHANGE      (skip the write)
 *  2. incoming is not a storable sltsStatus               -> UNKNOWN_STATUS (never write raw portal strings)
 *  3. a live feed may not reopen a portal-terminal row    -> TERMINAL_PROTECTED
 *  4. only completion authority may close a RETURN row    -> RETURN_LOCK
 *  5. a downgrade out of an older portal record           -> STALE_ANCHOR   (out-of-order feed)
 *  6. a downgrade the actor has no authority for          -> ILLEGAL_DOWNGRADE
 *  7. humans and the API may always move a row            -> APPLIED        (rules 1 and 2 still apply)
 *
 * Enforcement is switched by SYNC_STATUS_POLICY: 'logonly' records the verdict and lets the write
 * through (the first release, so the blocked-write census can be measured against real portal
 * traffic), 'enforce' applies it.
 */

import {
    SodStatus,
    SOD_SLTS_STATUS_VALUES,
    SOD_SLTS_TERMINAL_STATUSES,
} from './sod-constants';

/** Who is asking. Portal actors mirror a feed; ERP actors and humans decide policy. */
export type SyncActor =
    | 'PORTAL_SWEEP'      // per-RTOM live worklist (ftthpen) - least authoritative
    | 'PORTAL_COMPLETED'  // _COMPLETED_SLTS month walk - owns COMPLETED / INSTALL_CLOSED
    | 'PORTAL_PAT'        // PAT success / OPMC reject / HO approve-reject feeds
    | 'PORTAL_RETURN'     // _RETURNED_SLTS - owns RETURN and return reasons
    | 'AUTO_COMPLETE'     // ERP-side appointment/auto completion
    | 'USER'              // logged-in human through the UI
    | 'API';              // authenticated non-human caller (extension, bridge, integration)

export type StatusWriteReason =
    | 'APPLIED'
    | 'NO_CHANGE'
    | 'UNKNOWN_STATUS'
    | 'TERMINAL_PROTECTED'
    | 'RETURN_LOCK'
    | 'STALE_ANCHOR'
    | 'ILLEGAL_DOWNGRADE'
    /** Reserved for the writer: a human-evidence gate swallowed the transition. */
    | 'GATE_PENDING';

export interface StatusWriteDecision {
    readonly allow: boolean;
    readonly reason: StatusWriteReason;
}

/**
 * Lifecycle position. Higher = further along. Two dimensions are deliberately collapsed here
 * because the stored column is a single value: the PAT band sits above physical completion (a
 * passed PAT is a completed SOD that also cleared acceptance), a rejected PAT sits just above
 * COMPLETED (work done, acceptance failed). RETURN is a side band reachable from both active and
 * closed states - it is never inferred from rank, only from actor authority.
 */
export const SOD_STATUS_RANK: Readonly<Record<SodStatus, number>> = {
    [SodStatus.PENDING]: 0,
    [SodStatus.ASSIGNED]: 10,
    [SodStatus.DISAPPEARED]: 15,
    [SodStatus.INPROGRESS]: 20,
    [SodStatus.PROV_CLOSED]: 30,
    [SodStatus.RETURN]: 35,
    [SodStatus.COMPLETED]: 40,
    [SodStatus.PAT_OPMC_REJECTED]: 45,
    [SodStatus.PAT_REJECTED]: 45,
    [SodStatus.INSTALL_CLOSED]: 50,
    [SodStatus.PAT_OPMC_PASSED]: 60,
    [SodStatus.PAT_CORRECTED]: 60,
};

/** Portal has confirmed the work is finished; a live worklist row cannot undo that. */
export function isTerminalSltsStatus(status: string | null | undefined): boolean {
    return !!status && (SOD_SLTS_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** RETURN / DISAPPEARED: a parked row that only a feed with explicit authority may un-park. */
export function isReturnLikeSltsStatus(status: string | null | undefined): boolean {
    return status === SodStatus.RETURN || status === SodStatus.DISAPPEARED;
}

/** Values legitimately writable to `sltsStatus`. */
export function isStorableSltsStatus(status: string | null | undefined): status is string {
    return !!status && (SOD_SLTS_STATUS_VALUES as readonly string[]).includes(status);
}

/**
 * Which feed authority is asserting a given portal status.
 *
 * A recovery pass that reads several feeds at once (the disappeared detector walks completed,
 * rejected and returned) cannot claim one actor for every row it resolves: the actor is what the
 * rules key authority off, so a completion must be asserted by the completion feed and a return by
 * the return feed. Anything else stays an open-worklist observation.
 */
export function authorityActorFor(status: string | null | undefined): SyncActor {
    if (status === SodStatus.RETURN) return 'PORTAL_RETURN';
    if (isTerminalSltsStatus(status)) return 'PORTAL_COMPLETED';
    return 'PORTAL_SWEEP';
}

/** Portal actors that only mirror an open-work feed and may never rewrite history backwards. */
const OPEN_WORK_FEED_ACTORS: readonly SyncActor[] = ['PORTAL_SWEEP'];

/** Actors allowed to move a row into a completion status. */
const COMPLETION_AUTHORITY: readonly SyncActor[] = ['PORTAL_COMPLETED', 'AUTO_COMPLETE', 'USER', 'API'];

/** One second: CON_STATUS_DATE is second-granular and Prisma round-trips milliseconds. */
const ANCHOR_TOLERANCE_MS = 1000;

export interface StatusWriteInput {
    /** existing.sltsStatus */
    readonly current: string | null;
    /** normalised portal status we want to store */
    readonly incoming: string | null;
    /** portal CON_STATUS_DATE of the incoming row */
    readonly incomingAnchor: Date | null;
    /** existing.statusDate - the anchor of what we already stored */
    readonly storedAnchor: Date | null;
    readonly actor: SyncActor;
    /**
     * Other tracked payload fields. The completion date is part of the identity of a completion
     * write: a row that is already COMPLETED but has no completedDate must still be written, so a
     * caller that supplies one forces the transition to be treated as a change.
     */
    readonly forcesChange?: boolean;
}

function rankOf(status: string | null): number | null {
    if (!status) return null;
    const rank = SOD_STATUS_RANK[status as SodStatus];
    return typeof rank === 'number' ? rank : null;
}

/**
 * Decide whether a status write may be applied. Pure function - no I/O, no clock, no Prisma -
 * so the whole matrix is unit-testable and every writer shares one verdict.
 */
export function decideStatusWrite(input: StatusWriteInput): StatusWriteDecision {
    const { current, incoming, incomingAnchor, storedAnchor, actor, forcesChange } = input;

    // Rule 2 first: an unknown portal string must never reach the column at all.
    if (incoming && !isStorableSltsStatus(incoming)) {
        return { allow: false, reason: 'UNKNOWN_STATUS' };
    }

    // Rule 1: identical status and nothing else forcing the write - skip, so updatedAt,
    // status history and notifications stay untouched.
    if (incoming && incoming === current && !forcesChange) {
        return { allow: false, reason: 'NO_CHANGE' };
    }

    // No current status means the row has never been positioned: nothing to protect.
    if (!current) return { allow: true, reason: 'APPLIED' };

    // Rule 7: humans and non-portal integrations are authoritative by definition.
    if (actor === 'USER' || actor === 'API') return { allow: true, reason: 'APPLIED' };

    const currentRank = rankOf(current);
    const incomingRank = incoming ? rankOf(incoming) : null;
    const isDowngrade =
        currentRank !== null && incomingRank !== null && incomingRank < currentRank;

    // Rule 3: the open-work feed may not reopen anything the portal already closed. This is the
    // oscillation kill switch. It is scoped to PORTAL_SWEEP on purpose - the completion feed owns
    // lateral moves inside the terminal band (COMPLETED -> INSTALL_CLOSED, PAT refinement).
    if (OPEN_WORK_FEED_ACTORS.includes(actor) && isTerminalSltsStatus(current) && isDowngrade) {
        return { allow: false, reason: 'TERMINAL_PROTECTED' };
    }

    // Rule 4: RETURN -> a portal-terminal status needs completion authority. The live worklist
    // reactivating a returned SOD stays allowed (that is today's [SYNC-RESTORED] path: the portal
    // genuinely re-lists returned work), but closing one from the open feed would skip the
    // return-reason and material-rollback bookkeeping the completion feed owns.
    if (
        current === SodStatus.RETURN &&
        isTerminalSltsStatus(incoming) &&
        !COMPLETION_AUTHORITY.includes(actor)
    ) {
        return { allow: false, reason: 'RETURN_LOCK' };
    }

    // Rule 5: an out-of-order feed row (older CON_STATUS_DATE than what we stored) cannot rewrite
    // history backwards. Only evaluated for downgrades: a rank increase is never a history rewrite.
    if (
        isDowngrade &&
        incomingAnchor &&
        storedAnchor &&
        incomingAnchor.getTime() < storedAnchor.getTime() - ANCHOR_TOLERANCE_MS
    ) {
        return { allow: false, reason: 'STALE_ANCHOR' };
    }

    // Rule 6: a downgrade by a feed with no reopen authority.
    if (isDowngrade && actor === 'PORTAL_PAT') {
        return { allow: false, reason: 'ILLEGAL_DOWNGRADE' };
    }

    return { allow: true, reason: 'APPLIED' };
}

/** Policy mode. Defaults to logonly so a rollout measures before it blocks anything. */
export function syncStatusPolicyMode(): 'enforce' | 'logonly' {
    return process.env.SYNC_STATUS_POLICY === 'enforce' ? 'enforce' : 'logonly';
}

/**
 * Convenience for callers: the verdict together with the enforcement decision, so a logonly run
 * still writes and still records what would have been blocked.
 *
 * Two verdicts are not authority refusals and therefore ignore the mode: NO_CHANGE is an
 * optimization (writing it would bump updatedAt, re-stamp the anchor and feed the notification
 * flood for nothing), UNKNOWN_STATUS would store a value the column cannot hold.
 *
 * The two flags answer different questions and must stay different:
 *  - `refused`           = the policy said no (what the blocked-write census counts, any mode);
 *  - `wouldHaveBlocked`  = the policy said no AND the write went ahead anyway (logonly only), which
 *    is what the `_WOULD_BLOCK` tally suffix and the log line mean. Reporting the second one in
 *    enforce mode would label an executed block as a hypothetical one.
 */
export function evaluateStatusWrite(input: StatusWriteInput): {
    readonly decision: StatusWriteDecision;
    readonly proceed: boolean;
    readonly refused: boolean;
    readonly wouldHaveBlocked: boolean;
} {
    const decision = decideStatusWrite(input);
    const mode = syncStatusPolicyMode();
    const absolute = decision.reason === 'NO_CHANGE' || decision.reason === 'UNKNOWN_STATUS';
    const refused = !decision.allow && !absolute;
    return {
        decision,
        proceed: decision.allow || (refused && mode === 'logonly'),
        refused,
        wouldHaveBlocked: refused && mode === 'logonly',
    };
}
