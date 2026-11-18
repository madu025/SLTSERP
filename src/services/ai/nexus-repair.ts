import { ENTITY_DICTIONARY, humanizeField } from '@/services/ai/semantic-layer.service';
import type { ToolRun } from '@/services/ai/nexus-local-reply.service';

/**
 * Self-correction for the planning model. When it picks the wrong table, a field that does not exist or a bad
 * operator, the system tells it exactly what was wrong (names only, never rows) and lets it plan again.
 * The model never sees ERP data: the feedback is the error text and the list of valid field names.
 */
export const MAX_REPAIRS = 2;

/** The note sent back to the model when a custom report request was malformed, or null when no correction is needed. */
export function repairNote(run: ToolRun): string | null {
    if (run.name !== 'runCustomReport') return null;
    const r = run.result as { error?: string; repairable?: boolean; hint?: string } | null | undefined;
    if (!r?.error || !r.repairable) return null;
    return `FAILED: ${r.error} ${r.hint ?? ''} Call runCustomReport again with a corrected request that still answers the user's whole question: keep every condition the user asked for and change only the table, the field names, the operators or the value format. If what the user wants is held in a different table, switch to that table. Never drop a condition just to make the request run.`.replace(/\s+/g, ' ').trim();
}

const label = (entity: string, field: string) => ENTITY_DICTIONARY[entity]?.fields[field]?.label ?? humanizeField(field);

/** A title a manager can read: "Service orders by RTOM", "Total Revenue by RTOM", "Projects". */
export function reportTitle(args: Record<string, unknown> | undefined): string {
    const entity = String(args?.entity ?? '');
    const name = ENTITY_DICTIONARY[entity]?.label ?? humanizeField(entity);
    const agg = args?.aggregation as { groupBy?: string; targetField?: string; type?: string } | undefined;
    if (!agg?.groupBy) return name || 'Report';
    const by = label(entity, agg.groupBy);
    if (agg.type === 'SUM' || agg.type === 'AVG') return `${agg.type === 'AVG' ? 'Average' : 'Total'} ${label(entity, String(agg.targetField ?? ''))} by ${by}`;
    return `${name} by ${by}`;
}
