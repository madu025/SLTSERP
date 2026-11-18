/**
 * Keeps the system guides in step with the code they describe.
 *
 *   pnpm run check:guides           report problems and stale guides; exits 1 if any
 *   pnpm run guides:stamp [id...]   after REVIEWING a guide against the changed code, record the new fingerprint
 *
 * A guide is "stale" when a file it watches changed after the guide was last stamped. The fix is never to just
 * re-stamp: read what changed, update the guide text and its anchors, then stamp. See the update-system-guides skill.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDES } from '../src/content/guides';
import { guideFreshness, guideProblems } from '../src/content/guides/verify';

const STAMP_FILE = join(process.cwd(), 'src/content/guides/guide-stamps.json');
const args = process.argv.slice(2);
const stamp = args[0] === '--stamp';
const only = new Set(args.filter((a) => !a.startsWith('--')));
const guides = GUIDES.filter((g) => only.size === 0 || only.has(g.id));

let failed = false;
const stamps = JSON.parse(readFileSync(STAMP_FILE, 'utf8')) as Record<string, { stamp: string; reviewedAt: string }>;

for (const guide of guides) {
    const problems = guideProblems(guide);
    if (problems.length > 0) {
        failed = true;
        console.error(`✗ ${guide.id}: the guide no longer matches the code`);
        for (const p of problems) console.error(`    - ${p}`);
        continue;
    }
    const f = guideFreshness(guide);
    if (stamp) {
        stamps[guide.id] = { stamp: f.current, reviewedAt: new Date().toISOString().slice(0, 10) };
        console.log(`✓ ${guide.id}: stamped ${f.current}`);
    } else if (f.state === 'fresh') {
        console.log(`✓ ${guide.id}: up to date (${f.current})`);
    } else {
        failed = true;
        console.error(`✗ ${guide.id}: ${f.state === 'unstamped' ? 'never stamped' : 'the code it describes has changed since the guide was reviewed'}.`);
        console.error('    Review the guide against the changed code, update it, then run: pnpm run guides:stamp ' + guide.id);
    }
}

if (stamp && !failed) writeFileSync(STAMP_FILE, JSON.stringify(stamps, null, 2) + '\n');
process.exit(failed ? 1 : 0);
