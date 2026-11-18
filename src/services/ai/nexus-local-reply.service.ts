import type { NexusCard, NexusChart, NexusTable } from '@/services/ai/nexus-agent.service';
import type { GuideAnswer } from '@/services/guides/guide.service';

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
    executive?: { cards: NexusCard[]; table?: NexusTable };
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
    getExecutiveBrief: 'Executive brief',
    compareMetric: 'Comparison',
    findAnomalies: 'Unusual items',
    projectMetric: 'Projection',
    getProfile: 'Profile',
    getSystemGuide: 'Guide',
};

/** Renders a guide lookup as plain, numbered text. Nothing here comes from ERP data. */
export function renderGuide(g: GuideAnswer): string {
    const lines: string[] = [];
    if (!g.matched) {
        lines.push(`I could not find that in the ${g.guide} guide, so I will not guess. The guide covers:`);
        for (const t of g.otherTopics) lines.push(`- ${t}`);
        lines.push('', 'Ask about one of these, for example "how do I complete an order", or ask your supervisor or an administrator.');
        return lines.join('\n');
    }
    g.sections.forEach((s, i) => {
        if (i > 0) lines.push('');
        lines.push(`${s.title}`);
        if (s.where) lines.push(`Where: ${s.where}`);
        if (s.blocked) { lines.push(s.blocked); return; }
        s.steps.forEach((step, n) => lines.push(`${n + 1}. ${step}`));
        if (s.tips.length > 0) { lines.push('', 'Good to know:'); s.tips.forEach((t) => lines.push(`- ${t}`)); }
    });
    if (g.glossary.length > 0) {
        lines.push('', 'Terms:');
        g.glossary.forEach((e) => lines.push(`- ${e.term}: ${e.meaning}`));
    }
    if (g.otherTopics.length > 0) {
        lines.push('', `Other topics in the ${g.guide} guide: ${g.otherTopics.join('; ')}.`);
    }
    return lines.join('\n');
}

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
    static build(runs: ToolRun[], message: string): { text: string; table?: NexusTable; chart?: NexusChart; cards?: NexusCard[]; evidence?: string } {
        const parts: string[] = [];
        const evidence: string[] = [];
        const cards: NexusCard[] = [];
        let table: NexusTable | undefined;

        for (const run of runs) {
            const title = TITLES[run.name] ?? run.name;
            const result = run.result as Record<string, unknown> | null;
            if (!result || typeof result !== 'object') { parts.push(`${title}: no data.`); continue; }
            if (typeof result.error === 'string') { parts.push(`${title}: ${result.error}`); continue; }

            if (run.name === 'getSystemGuide') {
                const g = result as unknown as GuideAnswer;
                parts.push(renderGuide(g));
                evidence.push(`${g.guide} guide · reviewed ${g.reviewedAt} · written from the application's own screens, no ERP data used`);
                continue;
            }

            if (run.executive) {
                evidence.push(this.executiveEvidence(run));
                cards.push(...run.executive.cards);
                if (run.name === 'getExecutiveBrief') {
                    const r = run.result as { asOf?: string; scope?: string };
                    parts.push(`Executive brief (${r.scope === 'opmc' ? 'your OPMC' : 'company-wide'}), as of ${r.asOf ? r.asOf.slice(0, 16).replace('T', ' ') + ' UTC' : 'now'}.`);
                } else if (typeof (run.result as { summary?: string }).summary === 'string') {
                    parts.push((run.result as { summary: string }).summary);
                } else {
                    const r = run.result as { metric?: { label: string }; period?: { label: string }; compareTo?: { label: string } | null; rows?: unknown[] };
                    parts.push(`${r.metric?.label ?? 'Metric'}: ${r.period?.label ?? ''}${r.compareTo ? ` compared with ${r.compareTo.label}` : ''}${r.rows ? ', split by RTOM (largest change first)' : ''}.`);
                }
                if (run.executive.table) table = table ?? run.executive.table;
                continue;
            }
            if (run.name === 'runCustomReport' && typeof (run.result as { search?: string }).search === 'string') evidence.push((run.result as { search: string }).search);
            if (run.name === 'runCustomReport' && run.table) {
                const t = run.table;
                // The readable title and row count; exactly what was searched (filters, grouping, scope) is on the evidence line.
                parts.push(
                    `${t.title}: ${t.totalRows}${t.capped ? '+' : ''} row${t.totalRows === 1 ? '' : 's'}`
                    + (t.truncated ? ` (the first ${t.rows.length} are shown below)` : '') + '.',
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
        return { text, table, chart: table ? this.chartFor(table, message) : undefined, cards: cards.length > 0 ? cards.slice(0, 12) : undefined, evidence: evidence.length ? evidence.join(' | ') : undefined };
    }


    private static executiveEvidence(run: ToolRun): string {
        const r = run.result as {
            asOf?: string; scope?: string;
            metric?: { label: string }; period?: { label: string; from: string; to: string }; compareTo?: { label: string; from: string; to: string } | null;
        };
        if (run.name === 'getExecutiveBrief') return `Executive brief · ${r.scope === 'opmc' ? 'your OPMC only' : 'company-wide'} · as of ${r.asOf ? r.asOf.slice(0, 16).replace('T', ' ') + ' UTC' : 'now'}`;
        if (run.name === 'compareMetric' && r.period) return `${r.metric?.label ?? 'Metric'} · ${r.period.label} (${r.period.from} to ${r.period.to})${r.compareTo ? ` against ${r.compareTo.label} (${r.compareTo.from} to ${r.compareTo.to})` : ''}`;
        if (run.name === 'getProfile') return `Profile · ${String(run.args?.type ?? '')} ${String(run.args?.name ?? '')} · this month against the same days of last month`;
        if (run.name === 'projectMetric') return `Projection · ${String(run.args?.metric ?? '')} · pace of this month so far, tested on the last 3 months`;
        if (run.name === 'findAnomalies') return 'Unusual items · last 6 weeks of daily completions, last 7 days per RTOM, open orders older than 14 days, expense run-rate';
        return run.name;
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
