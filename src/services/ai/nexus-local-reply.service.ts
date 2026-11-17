import type { NexusCard, NexusChart, NexusTable } from '@/services/ai/nexus-agent.service';

/**
 * Builds the answer on our own server from tool results, for "plan-only" privacy mode.
 * In that mode the external model only chooses the tool and its arguments; it never sees any ERP data,
 * so the wording, table and chart are produced here from the database result.
 */
export interface ToolRun {
    name: string;
    args?: Record<string, unknown>;
    result: unknown;
    table?: NexusTable;
}

const TITLES: Record<string, string> = {
    getFinanceContext: 'Finance',
    getProjectsContext: 'Projects',
    getInventoryLowStockContext: 'Low stock items',
    getContractorsContext: 'Contractors',
    getStoresContext: 'Stores',
    getProcurementContext: 'Procurement',
    getBOMInvoicesContext: 'BOM invoices',
    getServiceOrderProgressContext: 'Service order progress',
    getJobCostingContext: 'Job costing',
    runCustomReport: 'Custom report',
};

const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const isScalar = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v);
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase());

function scalarLines(obj: Record<string, unknown>, prefix = '', depth = 0, out: string[] = []): string[] {
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || Array.isArray(v)) continue;
        if (isScalar(v)) out.push(`- ${label(prefix + k)}: ${typeof v === 'number' ? num(v) : String(v)}`);
        else if (typeof v === 'object' && depth < 1) scalarLines(v as Record<string, unknown>, `${k} `, depth + 1, out);
    }
    return out;
}


function scalarCards(obj: Record<string, unknown>, prefix: string, depth = 0, out: NexusCard[] = []): NexusCard[] {
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || Array.isArray(v)) continue;
        const name = (prefix ? `${prefix}: ` : '') + label(k);
        if (typeof v === 'number') out.push({ label: name, value: num(v) });
        else if (typeof v === 'boolean') out.push({ label: name, value: v ? 'Yes' : 'No' });
        else if (typeof v === 'string' && v.length <= 24) out.push({ label: name, value: v });
        else if (typeof v === 'object' && depth < 1) scalarCards(v as Record<string, unknown>, prefix ? `${prefix} ${label(k)}` : label(k), depth + 1, out);
    }
    return out;
}

function firstRowsArray(obj: Record<string, unknown>): { key: string; rows: Record<string, unknown>[] } | null {
    for (const [key, v] of Object.entries(obj)) {
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) return { key, rows: v as Record<string, unknown>[] };
    }
    return null;
}

export class NexusLocalReplyService {
    static build(runs: ToolRun[], message: string): { text: string; table?: NexusTable; chart?: NexusChart; cards?: NexusCard[] } {
        const parts: string[] = [];
        const cards: NexusCard[] = [];
        let table: NexusTable | undefined;

        for (const run of runs) {
            const title = TITLES[run.name] ?? run.name;
            const result = run.result as Record<string, unknown> | null;
            if (!result || typeof result !== 'object') { parts.push(`${title}: no data.`); continue; }
            if (typeof result.error === 'string') { parts.push(`${title}: ${result.error}`); continue; }

            if (run.name === 'runCustomReport' && run.table) {
                const t = run.table;
                const filters = Array.isArray(run.args?.filters) ? (run.args!.filters as Array<{ field?: string; operator?: string; value?: string }>).map((f) => `${f.field} ${f.operator} ${f.value}`).join('; ') : '';
                const agg = run.args?.aggregation as { type?: string; groupBy?: string; targetField?: string } | undefined;
                parts.push(
                    `${title} on ${String(run.args?.entity ?? '')}: ${t.totalRows}${t.capped ? '+' : ''} row${t.totalRows === 1 ? '' : 's'}`
                    + (t.truncated ? ` (the first ${t.rows.length} are shown below)` : '')
                    + (agg?.groupBy ? `, grouped by ${agg.groupBy} (${agg.type} of ${agg.targetField})` : '')
                    + (filters ? `. Filters: ${filters}` : '. No filters (all records).'),
                );
                table = table ?? t;
                continue;
            }

            // Presentation rule: a handful of headline numbers become KPI cards, lists become a table.
            const found = scalarCards(result, runs.length > 1 ? title : '');
            const arr = firstRowsArray(result);
            if (found.length > 0 && found.length <= 8) {
                cards.push(...found);
                parts.push(`${title} summary`);
            } else {
                parts.push([`${title}:`, ...scalarLines(result)].join('\n'));
            }
            if (arr && !table) {
                const columns = Object.keys(arr.rows[0]).filter((c) => isScalar(arr.rows[0][c]) || arr.rows[0][c] === null).slice(0, 8);
                table = {
                    title: `${title}: ${label(arr.key)}`,
                    columns,
                    rows: arr.rows.slice(0, 50).map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))),
                    totalRows: arr.rows.length,
                    truncated: arr.rows.length > 50,
                };
            }
        }

        const text = parts.join('\n\n') || 'No data found for this request.';
        return { text, table, chart: table ? this.chartFor(table, message) : undefined, cards: cards.length > 0 ? cards.slice(0, 12) : undefined };
    }

    private static chartFor(table: NexusTable, message: string): NexusChart | undefined {
        if (!/chart|graph|plot|satahan|prastar/i.test(message) || table.rows.length < 2) return undefined;
        const numeric = table.columns.filter((c) => table.rows.every((r) => typeof r[c] === 'number'));
        const category = table.columns.find((c) => !numeric.includes(c));
        if (!category || numeric.length === 0) return undefined;
        const type: NexusChart['type'] = /pie|donut|doughnut/i.test(message) ? 'pie' : /line|trend|over time/i.test(message) ? 'line' : 'bar';
        return {
            type,
            title: table.title,
            xAxisKey: category,
            seriesKeys: type === 'pie' ? numeric.slice(0, 1) : numeric.slice(0, 2),
            data: table.rows.slice(0, 20).map((r) => Object.fromEntries([[category, String(r[category] ?? '')], ...numeric.slice(0, 2).map((c) => [c, r[c] as number])])) as Record<string, string | number>[],
        };
    }
}
