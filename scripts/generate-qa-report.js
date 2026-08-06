/**
 * QA Agent report generator.
 *
 * Parses the append-only JSON-lines bug log produced by the QA agent specs
 * (tests/qa-agent/reports/bugs.json) and renders a deduplicated, grouped
 * markdown report at tests/qa-agent/reports/qa-report.md.
 *
 * Usage:
 *   node scripts/generate-qa-report.js
 */

const fs = require('fs');
const path = require('path');

const BUG_LOG = path.resolve(__dirname, '../tests/qa-agent/reports/bugs.json');
const OUT_FILE = path.resolve(__dirname, '../tests/qa-agent/reports/qa-report.md');

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function main() {
    if (!fs.existsSync(BUG_LOG)) {
        console.error(`No bug log found at ${BUG_LOG}. Run the QA agent specs first.`);
        process.exit(1);
    }

    const lines = fs.readFileSync(BUG_LOG, 'utf8').trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
        try {
            entries.push(JSON.parse(line));
        } catch {
            // Skip malformed lines (e.g. interrupted writes)
        }
    }

    if (entries.length === 0) {
        fs.writeFileSync(OUT_FILE, '# QA Agent Report\n\nNo bugs recorded.\n', 'utf8');
        console.log(`Report written to ${OUT_FILE} (0 bugs)`);
        return;
    }

    // Deduplicate: module|step|severity|normalized title
    const seen = new Map();
    for (const e of entries) {
        const normTitle = (e.title || '')
            .replace(/\([^)]*\)/g, '(*)')     // strip role suffixes
            .replace(/\/api\/\S+/g, '/api/*'); // normalize API urls
        const key = `${e.module}|${e.step}|${e.severity}|${normTitle}`;
        const existing = seen.get(key);
        if (existing) {
            existing.count += 1;
            if (e.at > existing.lastSeen) existing.lastSeen = e.at;
        } else {
            seen.set(key, { ...e, count: 1, lastSeen: e.at || '' });
        }
    }

    const unique = [...seen.values()];

    // Group by module
    const byModule = new Map();
    for (const bug of unique) {
        if (!byModule.has(bug.module)) byModule.set(bug.module, []);
        byModule.get(bug.module).push(bug);
    }

    // Sort bugs inside each module by severity then step
    for (const bugs of byModule.values()) {
        bugs.sort((a, b) => {
            const s = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
            return s !== 0 ? s : (a.step || '').localeCompare(b.step || '');
        });
    }

    const totals = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const bug of unique) totals[bug.severity] = (totals[bug.severity] || 0) + 1;

    const moduleOrder = [...byModule.keys()].sort();

    const out = [];
    out.push('# QA Agent Report');
    out.push('');
    out.push(`Generated: ${new Date().toISOString()}`);
    out.push(`Raw entries: ${entries.length} — unique bugs: ${unique.length}`);
    out.push('');
    out.push('## Summary');
    out.push('');
    out.push('| Severity | Unique bugs |');
    out.push('|---|---|');
    for (const sev of SEVERITY_ORDER) {
        out.push(`| ${sev} | ${totals[sev] || 0} |`);
    }
    out.push('');

    for (const module of moduleOrder) {
        const bugs = byModule.get(module);
        out.push(`## ${module} (${bugs.length} unique)`);
        out.push('');
        out.push('| # | Severity | Step | Bug | Seen | Last seen |');
        out.push('|---|---|---|---|---|---|');
        bugs.forEach((bug, i) => {
            const title = (bug.title || '').replace(/\|/g, '\\|');
            const when = bug.lastSeen ? bug.lastSeen.slice(0, 10) : '-';
            out.push(`| ${i + 1} | ${bug.severity} | ${bug.step} | ${title} | x${bug.count} | ${when} |`);
        });
        out.push('');
        // Evidence details
        for (const bug of bugs) {
            if (bug.evidence) {
                out.push(`**${bug.severity} / ${bug.step} — ${bug.title}**`);
                out.push('');
                out.push('```');
                out.push(String(bug.evidence).slice(0, 500));
                out.push('```');
                out.push('');
            }
        }
    }

    fs.writeFileSync(OUT_FILE, out.join('\n'), 'utf8');
    console.log(`Report written to ${OUT_FILE}`);
    console.log(`Unique bugs: ${unique.length} (CRITICAL ${totals.CRITICAL}, HIGH ${totals.HIGH}, MEDIUM ${totals.MEDIUM}, LOW ${totals.LOW})`);
}

main();
