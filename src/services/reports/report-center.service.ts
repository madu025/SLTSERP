import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { DynamicReportService, type AggregationConfig, type DynamicReportPayload, type FilterRule } from '@/services/inventory/dynamic-report.service';
import { ENTITY_DICTIONARY, describeSearch, groundReportFilters, humanizeField } from '@/services/ai/semantic-layer.service';

/**
 * One secure way to run a database report, shared by the Report Center page, the report APIs and the Nexus
 * assistant: the caller's capability for the entity, finance/cost field capabilities and the OPMC scope are
 * all enforced here, the filter values are checked against real data, and the engine computes every figure in
 * the database with reconciliation.
 */
export type OpmcScope = readonly string[] | undefined;

export const REPORT_ENTITY_PERMISSION: Record<string, string> = {
    serviceOrder: RBAC_PERMISSIONS.SOD_READ,
    materialUsage: RBAC_PERMISSIONS.SOD_READ,
    contractorStock: RBAC_PERMISSIONS.INVENTORY_READ,
    wastage: RBAC_PERMISSIONS.INVENTORY_READ,
    journalEntry: RBAC_PERMISSIONS.FINANCE_READ,
};

/** Entities whose rows can be limited to an OPMC; the others are company-wide only. */
const SCOPABLE = new Set(['serviceOrder', 'materialUsage']);
const NUMERIC = /(^|\.)(quantity|costPrice|unitPrice|revenueAmount|contractorAmount)$/;
const DATE = /(^|\.)(createdAt|updatedAt|completedDate|date|approvedAt)$/;
const UNIQUE_LIKE = /(^|\.)(soNum|customerName|voiceNumber|description|referenceId|id)$/;
const FINANCE_FIELD = /(^|\.)revenueAmount$/;
const COST_FIELD = /(^|\.)(costPrice|unitPrice)$/;

export interface ReportFieldMeta { path: string; label: string; kind: 'number' | 'date' | 'text'; /** sensible to group by (not a unique identifier, free text, date or number) */ groupable: boolean }
export interface ReportEntityMeta { id: string; label: string; description: string; fields: ReportFieldMeta[] }

function fieldAllowed(path: string, permissions: ReadonlySet<string>): boolean {
    if (FINANCE_FIELD.test(path) && !permissions.has(RBAC_PERMISSIONS.FINANCE_READ)) return false;
    if (COST_FIELD.test(path) && !permissions.has(RBAC_PERMISSIONS.INVENTORY_COST_READ)) return false;
    return true;
}

/** The entities and fields this caller may report on (what the Report Center builder offers). */
export function reportMeta(permissions: ReadonlySet<string>, scope: OpmcScope): ReportEntityMeta[] {
    return Object.keys(REPORT_ENTITY_PERMISSION)
        .filter((id) => permissions.has(REPORT_ENTITY_PERMISSION[id]) && (scope === undefined || SCOPABLE.has(id)))
        .map((id) => {
            const def = ENTITY_DICTIONARY[id];
            const fields = (DynamicReportService.fieldsFor(id) ?? [])
                .filter((p) => p !== 'id' && fieldAllowed(p, permissions))
                .map((p) => { const kind = (NUMERIC.test(p) ? 'number' : DATE.test(p) ? 'date' : 'text') as ReportFieldMeta['kind']; return { path: p, label: def?.fields[p]?.label ?? humanizeField(p), kind, groupable: kind === 'text' && !UNIQUE_LIKE.test(p) }; });
            return { id, label: def?.label ?? id, description: def?.description ?? '', fields };
        });
}

export interface RunReportOptions { rowLimit?: number }

export type ReportResult =
    | { error: string }
    | { type: string; columns: string[]; totalRows: number; rows: Array<Record<string, unknown>>; truncated: boolean; capped: boolean; search: string; verified: boolean };

export async function runUserReport(args: Record<string, unknown> | undefined, permissions: ReadonlySet<string>, opmcScope: OpmcScope, options: RunReportOptions = {}): Promise<ReportResult> {
    const entity = String(args?.entity ?? '') as DynamicReportPayload['entity'];
    const columns = Array.isArray(args?.columns) ? (args!.columns as unknown[]).map(String) : [];
    const filters = (Array.isArray(args?.filters) ? args!.filters as FilterRule[] : []).map((f) => ({ field: String(f.field), operator: f.operator, value: String(f.value) }));
    const agg = args?.aggregation as AggregationConfig | undefined;
    const aggregation = agg && agg.groupBy && agg.targetField && agg.type ? { groupBy: String(agg.groupBy), targetField: String(agg.targetField), type: agg.type } : undefined;

    const required = REPORT_ENTITY_PERMISSION[entity];
    if (!required || !permissions.has(required)) return { error: 'You do not have access to this report.' };

    const used = [...columns, ...filters.map((f) => f.field), ...(aggregation ? [aggregation.groupBy, aggregation.targetField] : [])];
    if (used.some((f) => FINANCE_FIELD.test(f)) && !permissions.has(RBAC_PERMISSIONS.FINANCE_READ)) return { error: 'Revenue figures require finance access.' };
    if (used.some((f) => COST_FIELD.test(f)) && !permissions.has(RBAC_PERMISSIONS.INVENTORY_COST_READ)) return { error: 'Cost figures require inventory cost access.' };

    let scopeWhere: Record<string, unknown> | undefined;
    if (opmcScope !== undefined) {
        if (entity === 'serviceOrder') scopeWhere = { opmcId: { in: [...opmcScope] } };
        else if (entity === 'materialUsage') scopeWhere = { serviceOrder: { opmcId: { in: [...opmcScope] } } };
        else return { error: 'This report is only available to users with company-wide access.' };
    }

    try {
        // Semantic layer: every name or value is checked against real data before the query runs
        const grounded = await groundReportFilters(entity, filters, opmcScope);
        if (grounded.issue) return { error: grounded.issue };
        const report = await DynamicReportService.generateReport({ entity, columns, filters: grounded.filters, aggregation }, { scopeWhere, opmcIds: opmcScope });
        const verified = (report as { verified?: boolean }).verified === true;
        const search = describeSearch({
            entity, filters: grounded.filters, groupBy: aggregation?.groupBy, rows: report.rows.length, capped: report.capped, asOf: new Date(),
            scope: opmcScope === undefined ? undefined : 'limited to your OPMC',
        }) + (verified ? ' · ✓ totals reconciled' : '') + (grounded.evidence.length ? ` · ${grounded.evidence.join('; ')}` : '');
        const limit = options.rowLimit ?? 50;
        return { type: report.type, columns: report.columns, totalRows: report.rows.length, rows: report.rows.slice(0, limit), truncated: report.rows.length > limit || report.capped, capped: report.capped, search, verified };
    } catch (error) {
        // Only our own validation messages are shown; database/Prisma errors can contain internal paths and queries.
        const known = error instanceof Error && /^(INVALID_ENTITY|INVALID_COLUMN|INVALID_FILTER|INVALID_AGGREGATION)/.test(error.message);
        if (!known) console.error('[REPORTS] Custom report failed:', error instanceof Error ? error.message.trim().split(/\r?\n/).filter(Boolean).slice(-4).join(' | ') : error);
        return { error: known ? (error as Error).message.replace(/^[A-Z_]+:\s*/, '') : 'The report could not be built with those filters. Check the field names, operators and values.' };
    }
}
