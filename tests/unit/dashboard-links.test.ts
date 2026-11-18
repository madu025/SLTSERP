import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every link on the dashboard (the tab components and the links the health and control-tower services send to the
 * page) must open a real page. A link to a folder that has only sub-pages is a 404 for the user.
 */
const root = path.resolve(__dirname, '../..');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

function pageExists(urlPath: string): boolean {
    const segs = urlPath.split('/').filter(Boolean);
    const walk = (dir: string, i: number): boolean => {
        if (i === segs.length) return fs.existsSync(path.join(dir, 'page.tsx')) || fs.readdirSync(dir, { withFileTypes: true }).some((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && walk(path.join(dir, e.name), i));
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const next = path.join(dir, e.name);
            if (/^\(.+\)$/.test(e.name)) { if (walk(next, i)) return true; continue; }
            if ((e.name === segs[i] || (e.name.startsWith('[') && !e.name.startsWith('[...'))) && walk(next, i + 1)) return true;
        }
        return false;
    };
    return walk(path.join(root, 'src/app'), 0);
}

test('every dashboard link opens a page that exists', () => {
    const sources = [
        ...files(path.join(root, 'src/app/dashboard')),
        path.join(root, 'src/services/core/company-health.service.ts'),
        path.join(root, 'src/services/core/executive-dashboard.service.ts'),
    ].filter((f) => /\.(ts|tsx)$/.test(f));
    const found = new Set<string>();
    for (const f of sources) {
        const text = fs.readFileSync(f, 'utf8');
        for (const m of text.matchAll(/href[=:]\s*\{?\s*["'`](\/[^"'`$?#]*)/g)) found.add(m[1].replace(/\/$/, '') || '/');
    }
    assert.ok(found.size > 20, `expected to find the dashboard links, found ${found.size}`);
    const dead = [...found].filter((p) => !pageExists(p));
    assert.deepEqual(dead, [], `these dashboard links have no page: ${dead.join(', ')}`);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
