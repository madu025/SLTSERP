/**
 * The weekly operations digest as an email: key figures, charts and the exceptions, drawn with HTML tables and inline styles only
 * (no images, no scripts), so it shows the same in Outlook, Gmail and on a phone. Pure functions, so every part is testable.
 * Text is dark on light and white on dark (contrast above 4.5:1).
 */
export interface DigestException { severity: 'critical' | 'warning' | 'info'; title: string; detail: string; area: string }

export interface DigestEmailInput {
    user: string;
    weekLabel: string;
    dashboardUrl: string;
    slaDays: number;
    /** Why this person receives it (the rule), shown in the footer. */
    reason: string;
    completed30d: number;
    slaPct30d: number | null;
    weeks: Array<{ weekStart: string; completed: number; withinPct: number | null }>;
    ageing: Array<{ bucket: string; count: number }>;
    openTotal: number;
    rtoms: Array<{ rtom: string; open: number; over14: number }>;
    received7d: number;
    completed7d: number;
    exceptions: DigestException[];
}

const FONT = "'Segoe UI',Arial,sans-serif";
export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => n.toLocaleString('en-US');
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/** Green when the target is met, amber when close, red when missed; slate when there is no figure. */
export function slaColor(pct: number | null): string {
    if (pct === null) return '#475569';
    if (pct >= 85) return '#047857';
    if (pct >= 70) return '#b45309';
    return '#b91c1c';
}

const AGE_COLORS: Record<string, string> = { '0-3': '#059669', '3-7': '#65a30d', '7-14': '#d97706', '14-30': '#ea580c', '30+': '#b91c1c' };
const AGE_LABELS: Record<string, string> = { '0-3': 'Under 3 days', '3-7': '3 to 7 days', '7-14': '7 to 14 days', '14-30': '14 to 30 days', '30+': 'Over 30 days' };

/** A horizontal bar: coloured part and grey rest; widths are whole percents, and a part of 0 is left out. */
export function bar(parts: Array<{ pct: number; color: string }>): string {
    let used = 0;
    const cells: string[] = [];
    for (const p of parts) {
        const w = Math.min(clamp(p.pct), 100 - used);
        if (w <= 0) continue;
        used += w;
        cells.push(`<td width="${w}%" bgcolor="${p.color}" style="background-color:${p.color};height:12px;line-height:12px;font-size:1px;">&nbsp;</td>`);
    }
    if (used < 100) cells.push(`<td width="${100 - used}%" bgcolor="#e2e8f0" style="background-color:#e2e8f0;height:12px;line-height:12px;font-size:1px;">&nbsp;</td>`);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${cells.join('')}</tr></table>`;
}

/** One chart row: a label, a bar, and a value. */
function chartRow(label: string, barHtml: string, value: string, valueColor = '#0f172a'): string {
    return `<tr>
      <td width="30%" style="padding:5px 8px 5px 0;font-size:13px;color:#334155;font-family:${FONT};white-space:nowrap;">${esc(label)}</td>
      <td width="45%" style="padding:5px 0;">${barHtml}</td>
      <td width="25%" align="right" style="padding:5px 0 5px 8px;font-size:13px;font-weight:600;color:${valueColor};font-family:${FONT};white-space:nowrap;">${value}</td>
    </tr>`;
}

function section(title: string, note: string, rows: string): string {
    return `<h3 style="font-size:15px;color:#0f172a;margin:26px 0 2px;font-family:${FONT};">${esc(title)}</h3>
    ${note ? `<p style="margin:0 0 8px;font-size:12px;color:#475569;font-family:${FONT};">${esc(note)}</p>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function tile(label: string, value: string, sub: string, color: string): string {
    return `<td width="50%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
        <tr><td style="padding:12px 14px;font-family:${FONT};">
          <div style="font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.4px;">${esc(label)}</div>
          <div style="font-size:28px;font-weight:700;line-height:1.2;color:${color};margin-top:2px;">${value}</div>
          <div style="font-size:12px;color:#334155;margin-top:2px;">${sub}</div>
        </td></tr>
      </table></td>`;
}

const weekName = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

export function exceptionsBlock(items: DigestException[]): string {
    if (items.length === 0) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:12px 14px;background-color:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;font-size:14px;color:#065f46;font-family:${FONT};">No operations or project exceptions this week.</td></tr></table>`;
    const order = { critical: 0, warning: 1, info: 2 } as const;
    return [...items].sort((a, b) => order[a.severity] - order[b.severity]).map((e) => {
        const c = e.severity === 'critical' ? '#b91c1c' : e.severity === 'warning' ? '#b45309' : '#475569';
        const chip = e.severity === 'critical' ? 'Critical' : e.severity === 'warning' ? 'Warning' : 'Note';
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr>
          <td width="4" bgcolor="${c}" style="background-color:${c};">&nbsp;</td>
          <td style="padding:8px 12px;background-color:#f8fafc;font-family:${FONT};">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(e.title)} <span style="font-size:11px;font-weight:700;color:${c};text-transform:uppercase;">${chip} · ${esc(e.area)}</span></div>
            <div style="font-size:13px;color:#334155;margin-top:2px;">${esc(e.detail)}</div>
          </td></tr></table>`;
    }).join('');
}

/** The body of the digest (tiles, charts, exceptions, button); the template or the built-in page puts it in a frame. */
export function buildOpsDigestReport(d: DigestEmailInput): string {
    const critical = d.exceptions.filter((e) => e.severity === 'critical').length;
    const over14 = d.ageing.filter((a) => a.bucket === '14-30' || a.bucket === '30+').reduce((n, a) => n + a.count, 0);
    const net = d.completed7d - d.received7d;

    const tiles = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>${tile('Completed, last 30 days', fmt(d.completed30d), 'service orders', '#1e3a8a')}${tile(`Within ${d.slaDays}-day target`, d.slaPct30d === null ? 'n/a' : `${d.slaPct30d}%`, d.slaPct30d === null ? 'no completed orders' : d.slaPct30d >= 85 ? 'target met' : d.slaPct30d >= 70 ? 'close to the target' : 'below the target', slaColor(d.slaPct30d))}</tr>
      <tr>${tile('Open now', fmt(d.openTotal), `${fmt(over14)} older than 14 days`, over14 > 0 ? '#b45309' : '#047857')}${tile('Critical exceptions', String(critical), `${d.exceptions.length} exception${d.exceptions.length === 1 ? '' : 's'} in all`, critical > 0 ? '#b91c1c' : '#047857')}</tr>
    </table>`;

    const weekRows = d.weeks.length === 0
        ? `<tr><td style="font-size:13px;color:#475569;font-family:${FONT};">No completed orders in the last 8 weeks.</td></tr>`
        : d.weeks.map((w) => chartRow(`Week of ${weekName(w.weekStart)}`, bar([{ pct: w.withinPct ?? 0, color: slaColor(w.withinPct) }]), w.withinPct === null ? 'n/a' : `${w.withinPct}% <span style="font-weight:400;color:#475569;">of ${fmt(w.completed)}</span>`, slaColor(w.withinPct))).join('');

    const maxAge = Math.max(1, ...d.ageing.map((a) => a.count));
    const ageRows = d.ageing.map((a) => chartRow(AGE_LABELS[a.bucket] ?? a.bucket, bar([{ pct: (a.count / maxAge) * 100, color: AGE_COLORS[a.bucket] ?? '#475569' }]), fmt(a.count))).join('');

    const maxOpen = Math.max(1, ...d.rtoms.map((r) => r.open));
    const rtomRows = d.rtoms.length === 0
        ? `<tr><td style="font-size:13px;color:#475569;font-family:${FONT};">No open orders.</td></tr>`
        : d.rtoms.map((r) => chartRow(r.rtom, bar([{ pct: ((r.open - r.over14) / maxOpen) * 100, color: '#1d4ed8' }, { pct: (r.over14 / maxOpen) * 100, color: '#b91c1c' }]), `${fmt(r.over14)} <span style="font-weight:400;color:#475569;">of ${fmt(r.open)} over 14 days</span>`, r.over14 > 0 ? '#b91c1c' : '#0f172a')).join('');

    const maxFlow = Math.max(1, d.received7d, d.completed7d);
    const flowRows = chartRow('Received', bar([{ pct: (d.received7d / maxFlow) * 100, color: '#1d4ed8' }]), fmt(d.received7d)) + chartRow('Completed', bar([{ pct: (d.completed7d / maxFlow) * 100, color: '#059669' }]), fmt(d.completed7d));
    const flowNote = net > 0 ? `More orders were completed than received: the backlog fell by ${fmt(net)}.` : net < 0 ? `More orders were received than completed: the backlog grew by ${fmt(-net)}.` : 'As many orders were completed as received.';

    return `${tiles}
    ${section(`Turnaround within ${d.slaDays} days, by week`, 'Share of the orders completed that week that met the target (last 8 weeks).', weekRows)}
    ${section('Open orders by age', 'How long the orders still open have been waiting.', ageRows)}
    ${section('Backlog by RTOM', 'The RTOMs with the most orders older than 14 days. Blue is within 14 days, red is older.', rtomRows)}
    ${section('Last 7 days', flowNote, flowRows)}
    <h3 style="font-size:15px;color:#0f172a;margin:26px 0 8px;font-family:${FONT};">Needs attention</h3>
    ${exceptionsBlock(d.exceptions)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 0;"><tr><td bgcolor="#1e40af" style="background-color:#1e40af;border-radius:6px;">
      <a href="${esc(d.dashboardUrl)}" style="display:inline-block;padding:12px 24px;white-space:nowrap;text-align:center;text-decoration:none;font-weight:600;font-size:14px;color:#ffffff;font-family:${FONT};">Open performance view</a>
    </td></tr></table>`;
}

/** The whole email page: a frame (header, greeting, footer) around the report. Used when no stored template carries the report. */
export function buildOpsDigestDocument(d: DigestEmailInput, report = buildOpsDigestReport(d)): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;"><tr><td align="center" style="padding:20px 12px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
      <tr><td bgcolor="#1e3a8a" style="background-color:#1e3a8a;padding:24px 28px;border-radius:8px 8px 0 0;">
        <div style="color:#ffffff;font-size:22px;font-weight:700;font-family:${FONT};">Weekly operations digest</div>
        <div style="color:#dbeafe;font-size:13px;margin-top:6px;font-family:${FONT};">Week of ${esc(d.weekLabel)} &middot; service orders and projects</div>
      </td></tr>
      <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:26px 28px;border-radius:0 0 8px 8px;">
        <p style="font-size:15px;color:#0f172a;margin:0 0 14px;font-family:${FONT};">Dear ${esc(d.user)},</p>
        ${report}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="padding-top:14px;border-top:1px solid #cbd5e1;font-size:12px;color:#475569;text-align:center;font-family:${FONT};">
          <p style="margin:0 0 6px;">${esc(d.reason)}</p>
          <p style="margin:0;">SLTS Nexus ERP - Outside Plant Operations</p>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** The plain-text alternative: the same figures in a few lines. */
export function buildOpsDigestText(d: DigestEmailInput): string {
    const lines = [
        `Weekly operations digest - week of ${d.weekLabel}`,
        '',
        `Completed in the last 30 days: ${fmt(d.completed30d)}`,
        `Within the ${d.slaDays}-day target: ${d.slaPct30d === null ? 'n/a' : `${d.slaPct30d}%`}`,
        `Open now: ${fmt(d.openTotal)} (${d.ageing.map((a) => `${AGE_LABELS[a.bucket] ?? a.bucket}: ${fmt(a.count)}`).join(', ')})`,
        `Last 7 days: ${fmt(d.received7d)} received, ${fmt(d.completed7d)} completed`,
        '',
        'Backlog by RTOM (orders over 14 days):',
        ...d.rtoms.map((r) => `  ${r.rtom}: ${fmt(r.over14)} of ${fmt(r.open)}`),
        '',
        d.exceptions.length === 0 ? 'No operations or project exceptions this week.' : 'Needs attention:',
        ...d.exceptions.map((e) => `  [${e.severity}] ${e.title} (${e.area}): ${e.detail}`),
        '',
        `Open the performance view: ${d.dashboardUrl}`,
        d.reason,
    ];
    return lines.join('\n');
}
