import { roleLabel } from '@/lib/gate-eligibility';

/**
 * The change history of a gate, in words. Gate edits are written to the audit log (action, the gate id, the steps before and the
 * request after); this turns one such row into a sentence an administrator can read. Pure, so the wording is testable.
 */
export interface StepSnapshot { id?: string; requiredRole?: string; eligibleRoles?: unknown; assignee?: string | null; skipIfNoApprover?: boolean | null }

const asArray = (v: unknown): StepSnapshot[] => (Array.isArray(v) ? (v as StepSnapshot[]) : []);

function stepName(s: StepSnapshot): string {
    const role = s.requiredRole && s.requiredRole !== 'CANONICAL_CAPABILITY_ONLY'
        ? s.requiredRole
        : Array.isArray(s.eligibleRoles) && typeof s.eligibleRoles[0] === 'string' ? (s.eligibleRoles[0] as string) : 'Step';
    return roleLabel(role.replace(/_GLOBAL$/, ''));
}

const chain = (steps: StepSnapshot[]) => (steps.length ? steps.map(stepName).join(' → ') : 'no steps');

const GATE_FIELDS: Record<string, string> = {
    isEnabled: 'on/off', queueMode: 'shared queue', domainAction: 'action after approval', label: 'name', notificationAudience: 'who is notified',
    reqOpmcPat: 'OPMC PAT required', reqHoPat: 'HO PAT required', reqSltsPat: 'SLTS PAT required', reqPhotoProof: 'photo proof', reqGpsLocation: 'GPS location', reqDocUpload: 'document upload',
    writeAuditLedger: 'audit ledger', generateIssueNote: 'issue note',
};

export function summariseGateChange(action: string, entity: string, oldValue: unknown, newValue: unknown): string {
    const before = asArray(oldValue);
    if (action === 'REPLACE_LEVELS') {
        const after = asArray((newValue as { levels?: unknown } | null)?.levels);
        return `Steps changed: ${chain(after)} (was ${chain(before)})`;
    }
    if (action === 'REORDER_LEVELS') {
        const ids = (newValue as { orderedLevelIds?: unknown } | null)?.orderedLevelIds;
        const byId = new Map(before.map((s) => [s.id, s]));
        const after = Array.isArray(ids) ? ids.map((i) => byId.get(i as string)).filter((s): s is StepSnapshot => Boolean(s)) : [];
        return `Steps reordered: ${chain(after)} (was ${chain(before)})`;
    }
    if (entity === 'PROCESS_GATE_LEVEL' && action === 'CREATE') return `Step added: ${chain([newValue as StepSnapshot])}`;
    if (entity === 'PROCESS_GATE_LEVEL' && action === 'DELETE') return `A step was removed (steps were: ${chain(before)})`;
    if (entity === 'PROCESS_GATE' && action === 'UPDATE') {
        const changed = Object.keys((newValue as Record<string, unknown> | null) ?? {}).map((k) => GATE_FIELDS[k] ?? k);
        return changed.length ? `Settings changed: ${changed.join(', ')}` : 'Settings changed';
    }
    if (entity === 'PROCESS_GATE' && action === 'DELETE') return 'The gate was deleted';
    return `${action.toLowerCase().replace(/_/g, ' ')}`;
}
