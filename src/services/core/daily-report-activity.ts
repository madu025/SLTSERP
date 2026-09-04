/**
 * Daily Operational Report - per-SOD day activity classification.
 *
 * Single source of truth for "what happened to this SOD on the report day".
 * Every report column (received / completed / install closed / returned /
 * wired only / material consumption) is derived from these flags, so two
 * columns can never disagree about the day an SOD belongs to.
 *
 * Anchoring discipline (do not loosen without a business decision):
 *  - A statusHistory event dated inside the day is the primary truth.
 *  - completedDate is the row-state fallback for the completion/install-close
 *    and return capture instants.
 *  - statusDate is used only when completedDate is null (born-terminal rows),
 *    because a stale statusDate must never re-count an SOD.
 *  - receivedDate counts as intake only when it precedes the SOD's own completion;
 *    a receipt stamped at or after closure is a sync backfill artifact.
 *  - A closure counts only when the ERP observed it (see closureObserved); a portal
 *    stamp discovered after the fact is SLT bookkeeping, not today's field output.
 */
import { SOD_EXCLUDED_FROM_PENDING, SOD_PENDING_DEFAULT_STATUSES } from '@/lib/constants/sod-constants';
import type { MaterialUsageLike } from './daily-report-material';

export interface SodDayWindow {
  start: Date;
  end: Date;
}

/** Minimal SOD shape the classifier needs (structurally satisfied by the report select). */
export interface SodDayActivitySource {
  status: string | null;
  sltsStatus: string | null;
  createdAt: Date;
  receivedDate: Date | null;
  statusDate: Date | null;
  completedDate: Date | null;
  wiredOnly: boolean | null;
  opmcPatStatus?: string | null;
  hoPatStatus?: string | null;
  sltsPatStatus?: string | null;
  statusHistory: { status: string; statusDate: Date | string | null }[];
  /** Contractor team resolved inside the ERP - proof the ERP tracked the work. */
  teamId?: string | null;
  /** Material issue rows captured in the ERP for this SOD (same shape the material rules read). */
  materialUsage: readonly MaterialUsageLike[];
}

export interface SodDayActivity {
  /** SOD landed in the RTOM's queue on this day (canonical receivedDate, else createdAt). */
  receivedToday: boolean;
  /** Still an open job by status (ignores dates) - used for "team worked today". */
  pendingNow: boolean;
  /** Open at the start of this day: received before it and still pending - today's backlog half. */
  morningCarryForward: boolean;
  /** Received today or carried into this morning's queue - i.e. part of today's flow. */
  inTodayFlow: boolean;
  installClosedToday: boolean;
  completedToday: boolean;
  returnedToday: boolean;
  patRejected: boolean;
  /** Row state says the SOD was provisionally closed during this day. */
  provClosedToday: boolean;
  /** A PROV_CLOSED history event dated inside this day exists. */
  provClosedEventToday: boolean;
  /** Wired-only flag recorded on the SOD itself. */
  wiredOnlyFlagged: boolean;
}

const toDate = (value: Date | string | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const inWindow = (value: Date | string | null, window: SodDayWindow): boolean => {
  const date = toDate(value);
  return !!date && date >= window.start && date <= window.end;
};

const hasEventInWindow = (
  history: { status: string; statusDate: Date | string | null }[],
  event: string,
  window: SodDayWindow,
): boolean => history.some((h) => (h.status || '').toUpperCase() === event && inWindow(h.statusDate, window));

const isTerminalForPending = (sltsStatus: string | null, status: string | null): boolean =>
  sltsStatus === 'RETURN' || sltsStatus === 'DISAPPEARED' || status === 'DISAPPEARED';

/** Classify one SOD against the report day. Pure - no DB, no mutation. */
export function classifySodDayActivity(order: SodDayActivitySource, window: SodDayWindow): SodDayActivity {
  const receivedAnchor = order.receivedDate || order.createdAt;

  // A receipt cannot post-date the work it authorised. Backfill writers mirrored the
  // portal closure instant into receivedDate, which made month-old jobs surface as
  // "Received Today"; such rows are today's records, not today's intake.
  const receiptIsGenuine = !order.completedDate || receivedAnchor.getTime() < order.completedDate.getTime();
  const receivedToday = receiptIsGenuine && inWindow(receivedAnchor, window);

  const pendingNow =
    !(SOD_EXCLUDED_FROM_PENDING as readonly string[]).includes(order.sltsStatus || '') &&
    (SOD_PENDING_DEFAULT_STATUSES as readonly string[]).includes(order.status || '');

  const morningCarryForward = !receivedToday && receivedAnchor < window.start && pendingNow;

  const terminalGateOpen = !isTerminalForPending(order.sltsStatus, order.status);

  // Closure evidence the ERP itself observed. Rows created by the missing-history
  // backfill carry the portal's CON_STATUS_DATE - a stamp written when SLT moved the
  // record, discovered hours or days later - so they made month-old jobs surface as
  // today's output (R-MD reported 36 completions where iShamp listed 5). The portal
  // stamp sits 5h30m ahead of the real instant, so comparing it with createdAt is
  // useless; the discriminator has to be evidence the ERP did the work itself: it held
  // the job before this day opened AND carries field data it captured (a resolved team,
  // material issue rows, or a status event it wrote). Backfilled rows carry none.
  const erpTrackedWork =
    !!order.teamId || order.materialUsage.length > 0 || order.statusHistory.length > 0;
  const closureRecordedByErp =
    hasEventInWindow(order.statusHistory, 'COMPLETED', window) ||
    hasEventInWindow(order.statusHistory, 'INSTALL_CLOSED', window);
  const closureObserved =
    closureRecordedByErp || (order.createdAt < window.start && erpTrackedWork);

  const installClosedToday =
    (order.status === 'INSTALL_CLOSED' || order.sltsStatus === 'INSTALL_CLOSED') &&
    terminalGateOpen &&
    closureObserved &&
    (hasEventInWindow(order.statusHistory, 'INSTALL_CLOSED', window) ||
      inWindow(order.completedDate, window) ||
      (!order.completedDate && inWindow(order.statusDate, window)));

  const completedToday =
    installClosedToday ||
    (closureObserved &&
      (hasEventInWindow(order.statusHistory, 'COMPLETED', window) ||
        ((order.sltsStatus === 'COMPLETED' || order.status === 'COMPLETED') &&
          inWindow(order.completedDate, window))));

  const returnedToday =
    order.sltsStatus === 'RETURN' &&
    (hasEventInWindow(order.statusHistory, 'RETURN', window) ||
      inWindow(order.completedDate, window) ||
      (!order.completedDate && inWindow(order.statusDate, window)));

  const patRejected =
    order.opmcPatStatus === 'REJECTED' ||
    order.hoPatStatus === 'REJECTED' ||
    order.sltsPatStatus === 'REJECTED';

  return {
    receivedToday,
    pendingNow,
    morningCarryForward,
    inTodayFlow: receivedToday || morningCarryForward,
    installClosedToday,
    completedToday,
    returnedToday,
    patRejected,
    provClosedToday: order.status === 'PROV_CLOSED' && inWindow(order.statusDate, window),
    provClosedEventToday: hasEventInWindow(order.statusHistory, 'PROV_CLOSED', window),
    wiredOnlyFlagged: order.wiredOnly === true,
  };
}
