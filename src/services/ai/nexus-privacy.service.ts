/**
 * Keeps ERP data from leaving the system more than necessary when the assistant uses an external model.
 *
 * Modes (env NEXUS_PRIVACY_MODE):
 *   off      nothing is changed (default only when the model runs on our own server)
 *   standard personal fields and phone/e-mail/NIC patterns are masked before text reaches the model (default)
 *   strict   standard, plus report rows never reach the model: it only receives column names, the row count and
 *            totals of numeric columns. The user still sees the full table, because rows are shown straight from the
 *            database, not through the model.
 */
export type PrivacyMode = 'off' | 'standard' | 'strict';

const MASK = '[masked]';

// Field names that identify a person or carry a secret
const SENSITIVE_KEY = /(customer|subscriber|voice|phone|mobile|contact|email|e-?mail|^nic$|nic_?no|nic_?number|passport|address|password|token|secret|bank|account.?(no|number)|iban|swift|salary|remark)/i;

const PATTERNS: Array<[RegExp, string]> = [
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
    [/(?<!\d)(?:\+?94|0)?7\d{8}(?!\d)/g, '[phone]'],           // Sri Lankan mobile numbers
    [/(?<!\d)0\d{9}(?!\d)/g, '[phone]'],                         // landline / voice numbers
    [/(?<!\d)(?:\d{9}[VvXx]|\d{12})(?!\d)/g, '[nic]'],           // old and new NIC formats
];

export class NexusPrivacyService {
    static mode(provider: 'external' | 'local' = 'external'): PrivacyMode {
        const raw = (process.env.NEXUS_PRIVACY_MODE || '').toLowerCase();
        if (raw === 'off' || raw === 'standard' || raw === 'strict') return raw;
        return provider === 'local' ? 'off' : 'standard';
    }

    /** Masks phone numbers, e-mail addresses and NICs inside free text (user messages, saved history). */
    static maskText(text: string, mode: PrivacyMode): string {
        if (mode === 'off') return text;
        return PATTERNS.reduce((t, [re, label]) => t.replace(re, label), text);
    }

    /** Prepares a tool result for the model. The unmodified result is still used for the user's own table. */
    static forModel(toolName: string, result: unknown, mode: PrivacyMode): unknown {
        if (mode === 'off') return result;
        if (mode === 'strict' && toolName === 'runCustomReport') return this.reportSummary(result as ReportResult);
        return this.mask(result, mode, 0);
    }

    private static mask(value: unknown, mode: PrivacyMode, depth: number): unknown {
        if (depth > 8) return MASK;
        if (typeof value === 'string') return this.maskText(value, mode);
        if (Array.isArray(value)) return value.slice(0, 200).map((v) => this.mask(v, mode, depth + 1));
        if (value && typeof value === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                out[k] = SENSITIVE_KEY.test(k) && v !== null && v !== undefined && typeof v !== 'number' && typeof v !== 'boolean'
                    ? MASK
                    : this.mask(v, mode, depth + 1);
            }
            return out;
        }
        return value;
    }

    private static reportSummary(report: ReportResult): unknown {
        if (!report || report.error || !Array.isArray(report.rows) || !Array.isArray(report.columns)) return report;
        const numeric: Record<string, { sum: number; min: number; max: number }> = {};
        for (const col of report.columns) {
            const nums = report.rows.map((r) => r[col]).filter((v) => typeof v === 'number') as number[];
            if (nums.length > 0 && nums.length === report.rows.filter((r) => r[col] !== null && r[col] !== undefined).length) {
                numeric[col] = { sum: nums.reduce((a, b) => a + b, 0), min: Math.min(...nums), max: Math.max(...nums) };
            }
        }
        return {
            type: report.type,
            columns: report.columns,
            totalRows: report.totalRows,
            moreRowsExist: report.capped === true,
            numericTotals: numeric,
            note: 'Row values are withheld from the assistant for privacy. The user sees the full table; write a short summary from the totals only and do not invent row values.',
        };
    }
}

interface ReportResult {
    error?: string;
    type?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    totalRows?: number;
    capped?: boolean;
}
