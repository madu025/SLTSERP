import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bar, buildOpsDigestDocument, buildOpsDigestReport, buildOpsDigestText, esc, exceptionsBlock, slaColor, type DigestEmailInput } from '../../src/lib/ops-digest-email';

const base: DigestEmailInput = {
    user: 'Nuwan <Perera>', weekLabel: '2026-11-23', dashboardUrl: 'https://example.lk/service-orders/performance?a=1&b=2', slaDays: 7, reason: 'You receive this because of the rule.',
    completed30d: 7688, slaPct30d: 72.9,
    weeks: [{ weekStart: '2026-11-09', completed: 2045, withinPct: 78.2 }, { weekStart: '2026-11-16', completed: 2131, withinPct: 72.5 }],
    ageing: [{ bucket: '0-3', count: 624 }, { bucket: '3-7', count: 267 }, { bucket: '7-14', count: 149 }, { bucket: '14-30', count: 113 }, { bucket: '30+', count: 278 }],
    openTotal: 1431, rtoms: [{ rtom: 'R-WT', open: 60, over14: 27 }, { rtom: 'R-AG', open: 12, over14: 0 }],
    received7d: 2168, completed7d: 1776,
    exceptions: [{ severity: 'warning', title: 'R-WT backlog <ageing>', detail: '27 of 60', area: 'Operations' }, { severity: 'critical', title: 'Over 30 days', detail: '278 orders', area: 'Operations' }],
};

test('the report has the key figures, the charts and the exceptions', () => {
    const html = buildOpsDigestReport(base);
    for (const text of ['Completed, last 30 days', '7,688', '72.9%', 'Open now', '1,431', 'Critical exceptions', 'Turnaround within 7 days, by week', 'Week of 09 Nov', 'Open orders by age', 'Over 30 days', 'Backlog by RTOM', 'R-WT', 'Last 7 days', 'Needs attention', 'Open performance view']) {
        assert.ok(html.includes(text), text);
    }
    assert.ok(html.includes('More orders were received than completed: the backlog grew by 392.'), '2,168 received against 1,776 completed');
    assert.ok(html.includes('391 older than 14 days'), 'older than 14 days = 113 + 278');
});

test('every value that comes from data is escaped, so a name or a title cannot inject markup', () => {
    const doc = buildOpsDigestDocument(base);
    assert.ok(!doc.includes('Nuwan <Perera>') && doc.includes('Nuwan &lt;Perera&gt;'));
    assert.ok(!doc.includes('backlog <ageing>') && doc.includes('backlog &lt;ageing&gt;'));
    assert.ok(doc.includes('a=1&amp;b=2'), 'the link is escaped in the attribute');
    assert.equal(esc(null), '');
});

test('the bars are tables with whole-percent widths that never pass 100, and a part of zero is left out', () => {
    assert.match(bar([{ pct: 40, color: '#111111' }]), /width="40%"[^>]*bgcolor="#111111"[\s\S]*width="60%"/);
    const two = bar([{ pct: 70, color: '#111111' }, { pct: 70, color: '#222222' }]);
    assert.ok(two.includes('width="70%"') && two.includes('width="30%"') && !two.includes('width="100%" bgcolor'), 'the second part is cut to what is left');
    assert.ok(!bar([{ pct: 0, color: '#111111' }]).includes('#111111'), 'a zero part is not drawn');
    assert.ok(bar([{ pct: 250, color: '#111111' }]).includes('width="100%" bgcolor="#111111"'));
    assert.ok(bar([{ pct: Number.NaN, color: '#111111' }]).includes('width="100%" bgcolor="#e2e8f0"'));
});

test('the colour of the target figure: green met, amber close, red missed, grey without a figure', () => {
    assert.equal(slaColor(90), '#047857');
    assert.equal(slaColor(72.9), '#b45309');
    assert.equal(slaColor(50), '#b91c1c');
    assert.equal(slaColor(null), '#475569');
});

test('the empty cases read properly: no exceptions, no completed orders, no open orders', () => {
    const empty = buildOpsDigestReport({ ...base, exceptions: [], weeks: [], rtoms: [], completed30d: 0, slaPct30d: null, openTotal: 0, ageing: base.ageing.map((a) => ({ ...a, count: 0 })), received7d: 0, completed7d: 0 });
    assert.ok(empty.includes('No operations or project exceptions this week.'));
    assert.ok(empty.includes('No completed orders in the last 8 weeks.'));
    assert.ok(empty.includes('No open orders.'));
    assert.ok(empty.includes('n/a') && empty.includes('no completed orders'));
    assert.ok(empty.includes('As many orders were completed as received.'));
    assert.ok(exceptionsBlock([]).includes('No operations or project exceptions'));
});

test('critical exceptions come before warnings', () => {
    const html = exceptionsBlock(base.exceptions);
    assert.ok(html.indexOf('Over 30 days') < html.indexOf('R-WT backlog'));
});

test('text is dark on light and white on dark: no light text colour is used on a white or light background', () => {
    const doc = buildOpsDigestDocument(base);
    // the only white text sits on the dark blue header and the dark blue button
    const whiteTexts = doc.match(/(?<![-\w])color:#ffffff/g) ?? [];
    assert.equal(whiteTexts.length, 2);
    assert.ok(!/(?<![-\w])color:#(?:f1f5f9|e2e8f0|cbd5e1|94a3b8)/.test(doc), 'no pale grey text');
});

test('the plain-text version has the same figures', () => {
    const text = buildOpsDigestText(base);
    for (const t of ['7,688', '72.9%', '1,431', 'R-WT: 27 of 60', '[critical] Over 30 days', 'https://example.lk/service-orders/performance?a=1&b=2']) assert.ok(text.includes(t), t);
});

test('the digest service builds the report per person, uses a stored template only when it carries the report, and sends the text version', () => {
    const svc = fs.readFileSync('src/services/notification/ops-weekly-digest.service.ts', 'utf8');
    assert.ok(svc.includes('buildOpsDigestReport(input)') && svc.includes('buildOpsDigestDocument(input, reportHtml)') && svc.includes('buildOpsDigestText(input)'));
    assert.ok(svc.includes("includes('{{reportHtml}}')") && svc.includes('renderEmailByCode'));
    assert.ok(svc.includes('SodPerformanceService.getDigestData(now)'));
    const seed = fs.readFileSync('prisma/seed-notification-templates.ts', 'utf8');
    assert.ok(seed.includes('{{reportHtml}}') && seed.includes('{{reason}}'));
    assert.ok(fs.readFileSync('src/config/notification-templates.ts', 'utf8').includes("'reportHtml', 'reason'"));
});
