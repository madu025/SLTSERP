/**
 * Sync module contract types.
 *
 * Shared vocabulary for the feeds, the status writer, the audit recorder and the worker.
 * Everything here is a closed union on purpose: a new feed or job type must be added to the
 * registry in `src/workers/sod-sync.worker.ts`, which turns today's silent `else`
 * fallthrough (defect O9: an unknown job type quietly ran the pending sync) into a compile error.
 */

import type { StatusWriteDecision, StatusWriteReason, SyncActor } from '@/lib/constants/sod-status-policy';

export type { StatusWriteDecision, StatusWriteReason, SyncActor };

/** Payload types the sod-sync worker accepts. Exhaustive against JOB_HANDLERS. */
export type SyncJobType =
    | 'PENDING'
    | 'RTOM_SWEEP'
    | 'PAT_REJECTION'
    | 'PERIODIC_GLOBAL_SYNC'
    | 'PERIODIC_PENDING_SYNC'
    | 'PERIODIC_COMPLETED_SYNC'
    | 'PERIODIC_RETURN_SYNC';

/** Payload types the system worker accepts (wall-clock dailies, scheduled by the same tick). */
export type DailyJobType =
    | 'DAILY_REPORT_SNAPSHOT'
    | 'APPOINTMENT_REMINDERS'
    | 'DAILY_AUTOMATION'
    | 'NOTIFICATION_CLEANUP';

export interface SyncJobData {
    opmcId: string;
    rtom: string;
    type?: SyncJobType;
    windowMs?: number;
    slotMs?: number;
}

/** SyncRun.feed values - one per observable pass. Keep in sync with the model doc comment. */
export const SYNC_FEEDS = [
    'TICK',
    'RTOM_SWEEP',
    'PENDING_SWEEP',
    'PENDING_INTAKE',
    'DISAPPEARED',
    'COMPLETED',
    'PAT',
    'PAT_HO_APPROVED',
    'PAT_HO_REJECTED',
    'RETURN',
    'BRIDGE_SYNC',
    'SELF_HEAL',
    'DAILY_REPORT',
    'NOTIFICATION_CLEANUP',
] as const;

export type SyncFeed = (typeof SYNC_FEEDS)[number];

/** Row counters every pass reports, persisted on the SyncRun row (defect O7's front door). */
export interface SyncCounters {
    fetched: number;
    created: number;
    updated: number;
    skippedNoChange: number;
    blockedByPolicy: number;
}

export const emptySyncCounters = (): SyncCounters => ({
    fetched: 0,
    created: 0,
    updated: 0,
    skippedNoChange: 0,
    blockedByPolicy: 0,
});

/** Uniform feed result: counters + per-record errors, never a bare `any`. */
export interface SyncResult extends SyncCounters {
    feed: SyncFeed;
    rtom?: string;
    opmcId?: string;
    /** Verdict tally keyed by StatusWriteReason (plus a `_WOULD_BLOCK` suffix in logonly mode). */
    decisions: Record<string, number>;
    errors: string[];
}

export interface SyncWindow {
    start: Date | null;
    end: Date | null;
}

/** The single entityType used for SOD process gates and audit rows (defect O5). */
export const SOD_GATE_ENTITY_TYPE = 'SERVICE_ORDER' as const;
