import { prisma } from '@/lib/prisma';
import { swrMemo } from '@/lib/swr-memo';

/**
 * Semantic layer for the assistant: a data dictionary (what each entity and field means, with plain-language
 * synonyms) and value grounding (a name or value from the user's words is matched against what really exists
 * before any query runs). The external model never sees this data; it only receives the field and value names
 * in the tool description.
 */
export interface FieldDef { label: string; synonyms: string[] }
export interface EntityDef { label: string; synonyms: string[]; description: string; fields: Record<string, FieldDef> }

export const ENTITY_DICTIONARY: Record<string, EntityDef> = {
    serviceOrder: {
        label: 'Service orders', synonyms: ['service order', 'sod', 'orders', 'work orders', 'wada', 'ඇණවුම්'],
        description: 'Telecom service orders received from SLT and completed by contractors',
        fields: {
            soNum: { label: 'Order number', synonyms: ['so number', 'order no'] },
            status: { label: 'Status', synonyms: ['state', 'තත්ත්වය'] },
            sltsStatus: { label: 'SLTS status', synonyms: ['slts state'] },
            customerName: { label: 'Customer', synonyms: ['customer', 'client', 'පාරිභෝගික'] },
            voiceNumber: { label: 'Voice number', synonyms: ['phone number', 'telephone', 'දුරකථන'] },
            rtom: { label: 'RTOM', synonyms: ['area', 'region', 'exchange', 'rtom code'] },
            completedDate: { label: 'Completed date', synonyms: ['completed on', 'finished', 'ඉවර වූ දිනය'] },
            revenueAmount: { label: 'Revenue', synonyms: ['income', 'amount', 'ආදායම'] },
            createdAt: { label: 'Created', synonyms: ['created on', 'received'] },
        },
    },
    materialUsage: {
        label: 'Material usage', synonyms: ['material used', 'materials', 'usage'],
        description: 'Materials used on service orders',
        fields: { quantity: { label: 'Quantity', synonyms: ['qty'] }, usageType: { label: 'Usage type', synonyms: ['type'] }, 'item.name': { label: 'Item', synonyms: ['material'] } },
    },
    contractorStock: {
        label: 'Contractor stock', synonyms: ['contractor stock', 'stock held', 'thoguwa', 'තොග'],
        description: 'Stock currently held by contractors',
        fields: { quantity: { label: 'Quantity', synonyms: ['qty'] }, 'contractor.name': { label: 'Contractor', synonyms: ['contractor'] }, 'item.name': { label: 'Item', synonyms: ['material'] } },
    },
    wastage: {
        label: 'Wastage', synonyms: ['wastage', 'waste', 'damaged'],
        description: 'Contractor wastage records',
        fields: { status: { label: 'Status', synonyms: ['state'] }, month: { label: 'Month', synonyms: [] } },
    },
    journalEntry: {
        label: 'Journal entries', synonyms: ['journal', 'ledger entries', 'accounting entries'],
        description: 'Accounting journal entries',
        fields: { referenceType: { label: 'Reference type', synonyms: ['type'] }, date: { label: 'Date', synonyms: ['posted on'] } },
    },
};

/** Service order status values (mirrors the database enum) with the words people use for them. */
export const SERVICE_ORDER_STATUSES = ['PENDING', 'INPROGRESS', 'ASSIGNED', 'COMPLETED', 'RETURN', 'DISAPPEARED', 'INSTALL_CLOSED', 'PROV_CLOSED', 'PAT_OPMC_PASSED', 'PAT_OPMC_REJECTED', 'PAT_CORRECTED', 'PAT_REJECTED'] as const;
const STATUS_SYNONYMS: Record<string, string[]> = {
    PENDING: ['pending', 'waiting', 'not started'],
    INPROGRESS: ['in progress', 'ongoing', 'working', 'processing'],
    ASSIGNED: ['assigned', 'allocated', 'given'],
    COMPLETED: ['completed', 'complete', 'done', 'finished', 'ඉවර'],
    RETURN: ['return', 'returned', 'rejected by customer'],
    DISAPPEARED: ['disappeared', 'missing'],
    INSTALL_CLOSED: ['install closed', 'installation closed'],
    PROV_CLOSED: ['prov closed', 'provisioning closed'],
    PAT_OPMC_PASSED: ['pat opmc passed', 'pat passed'],
    PAT_OPMC_REJECTED: ['pat opmc rejected'],
    PAT_CORRECTED: ['pat corrected', 'corrected'],
    PAT_REJECTED: ['pat rejected'],
};

// ---------- pure matching (unit tested) ----------

export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9඀-෿]+/g, '');

export function editDistance(a: string, b: string): number {
    if (a === b) return 0;
    const m = a.length; const n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}

export type Grounded = { kind: 'match'; value: string } | { kind: 'ambiguous'; options: string[] } | { kind: 'none'; suggestions: string[] };

/**
 * Match what the user wrote against the real values. Order: exact (ignoring case, spaces, punctuation), then a
 * unique value that starts with it, then a unique close spelling (one or two typos).
 */
export function groundValue(raw: string, candidates: readonly string[], synonyms: Record<string, string[]> = {}): Grounded {
    const q = norm(raw);
    if (!q) return { kind: 'none', suggestions: candidates.slice(0, 5) };
    const exact = candidates.filter((c) => norm(c) === q);
    if (exact.length === 1) return { kind: 'match', value: exact[0] };
    for (const [value, words] of Object.entries(synonyms)) if (words.some((w) => norm(w) === q) && candidates.includes(value)) return { kind: 'match', value };
    const prefix = candidates.filter((c) => norm(c).startsWith(q));
    if (prefix.length === 1) return { kind: 'match', value: prefix[0] };
    if (prefix.length > 1) return { kind: 'ambiguous', options: prefix.slice(0, 8) };
    if (q.length >= 4) {
        const inside = candidates.filter((c) => norm(c).includes(q));
        if (inside.length === 1) return { kind: 'match', value: inside[0] };
        if (inside.length > 1) return { kind: 'ambiguous', options: inside.slice(0, 8) };
    }
    const close = candidates.map((c) => ({ c, d: editDistance(norm(c), q) })).filter((x) => x.d <= (q.length >= 5 ? 2 : 1)).sort((a, b) => a.d - b.d);
    if (close.length === 1 || (close.length > 1 && close[0].d < close[1].d)) return { kind: 'match', value: close[0].c };
    if (close.length > 1) return { kind: 'ambiguous', options: close.slice(0, 8).map((x) => x.c) };
    const nearest = candidates.map((c) => ({ c, d: editDistance(norm(c), q) })).sort((a, b) => a.d - b.d).slice(0, 5).map((x) => x.c);
    return { kind: 'none', suggestions: nearest };
}

// ---------- real values from the database ----------

type Scope = readonly string[] | undefined;
const scopeKey = (s: Scope) => (s === undefined ? 'all' : [...s].sort().join(','));

/** RTOM codes the caller may see (limited to their OPMC scope, so other areas cannot be listed). */
export async function listRtoms(scope: Scope): Promise<string[]> {
    return swrMemo(`semantic:rtoms:${scopeKey(scope)}`, 10 * 60_000, 60 * 60_000, async () => {
        const rows = await prisma.serviceOrder.findMany({ where: scope === undefined ? {} : { opmcId: { in: [...scope] } }, distinct: ['rtom'], select: { rtom: true }, orderBy: { rtom: 'asc' }, take: 500 });
        return rows.map((r) => r.rtom).filter(Boolean);
    });
}

import type { FilterRule } from '@/services/inventory/dynamic-report.service';
export type { FilterRule };
export interface GroundingResult { filters: FilterRule[]; evidence: string[]; issue?: string }

const STATUS_FIELDS = /(^|\.)(status|sltsStatus)$/;
const RTOM_FIELDS = /(^|\.)rtom$/;

/** Verifies each filter value against real data before the query is built; fixes spelling and case, or explains why not. */
export async function groundReportFilters(entity: string, filters: FilterRule[], scope: Scope): Promise<GroundingResult> {
    const out: FilterRule[] = [];
    const evidence: string[] = [];
    for (const f of filters) {
        let rule = { ...f };
        if (RTOM_FIELDS.test(f.field) && (entity === 'serviceOrder' || entity === 'materialUsage')) {
            const g = groundValue(f.value, await listRtoms(scope));
            if (g.kind === 'ambiguous') return { filters, evidence, issue: `"${f.value}" matches several RTOMs: ${g.options.join(', ')}. Which one do you mean?` };
            if (g.kind === 'none') return { filters, evidence, issue: `There is no RTOM "${f.value}" in the data you can see.${g.suggestions.length ? ` Closest: ${g.suggestions.join(', ')}.` : ''}` };
            if (g.value !== f.value) evidence.push(`RTOM "${f.value}" read as ${g.value}`);
            rule = { ...rule, operator: 'equals', value: g.value };
        } else if (entity === 'serviceOrder' && STATUS_FIELDS.test(f.field)) {
            const g = groundValue(f.value, SERVICE_ORDER_STATUSES, STATUS_SYNONYMS);
            if (g.kind === 'ambiguous') return { filters, evidence, issue: `"${f.value}" could be ${g.options.join(', ')}. Which status do you mean?` };
            if (g.kind === 'none') return { filters, evidence, issue: `"${f.value}" is not a service order status. Statuses: ${SERVICE_ORDER_STATUSES.join(', ')}.` };
            if (g.value !== f.value) evidence.push(`status "${f.value}" read as ${g.value}`);
            rule = { ...rule, operator: 'equals', value: g.value };
        }
        out.push(rule);
    }
    return { filters: out, evidence };
}

/** The one line shown under an answer: what was searched. */
export function describeSearch(parts: { entity?: string; filters?: FilterRule[]; groupBy?: string; period?: string; rows?: number; capped?: boolean; scope?: string; asOf?: Date }): string {
    const bits: string[] = [];
    if (parts.entity) bits.push(ENTITY_DICTIONARY[parts.entity]?.label ?? parts.entity);
    if (parts.filters?.length) bits.push(parts.filters.map((f) => `${ENTITY_DICTIONARY[parts.entity ?? '']?.fields[f.field]?.label ?? f.field} ${f.operator} ${f.value}`).join(' and '));
    else if (parts.entity) bits.push('no filters');
    if (parts.groupBy) bits.push(`grouped by ${ENTITY_DICTIONARY[parts.entity ?? '']?.fields[parts.groupBy]?.label ?? parts.groupBy}`);
    if (parts.period) bits.push(parts.period);
    if (parts.scope) bits.push(parts.scope);
    if (parts.rows !== undefined) bits.push(`${parts.rows.toLocaleString('en-US')}${parts.capped ? '+' : ''} row${parts.rows === 1 ? '' : 's'}`);
    if (parts.asOf) bits.push(`as of ${parts.asOf.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    return bits.join(' · ');
}
