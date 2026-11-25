import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CHUNK_RECOVERY_SCRIPT } from '../../src/lib/chunk-recovery';

/** Runs the inline script against a fake window and returns what the page did. */
function run() {
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    const store: Record<string, string> = {};
    let reloads = 0;
    const sandbox: Record<string, unknown> = {
        window: { addEventListener: (n: string, f: (e: unknown) => void) => { (listeners[n] ??= []).push(f); } },
        sessionStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } },
        location: { reload: () => { reloads++; } },
        Date,
        String,
    };
    vm.runInNewContext(CHUNK_RECOVERY_SCRIPT, sandbox);
    return { fire: (n: string, e: unknown) => (listeners[n] ?? []).forEach((f) => f(e)), reloads: () => reloads, store };
}

test('a build script that cannot be loaded reloads the page once', () => {
    const p = run();
    p.fire('error', { target: { tagName: 'SCRIPT', src: 'https://x/_next/static/chunks/abc.js' } });
    assert.equal(p.reloads(), 1);
    p.fire('error', { target: { tagName: 'SCRIPT', src: 'https://x/_next/static/chunks/def.js' } });
    assert.equal(p.reloads(), 1, 'a second failure within a minute does not reload again (no loop)');
});

test('other failed files, and ordinary errors, do not reload', () => {
    const p = run();
    p.fire('error', { target: { tagName: 'IMG', src: 'https://x/_next/static/a.png' } });
    p.fire('error', { target: { tagName: 'SCRIPT', src: 'https://analytics.example/a.js' } });
    p.fire('error', { target: {}, message: 'TypeError: x is undefined' });
    assert.equal(p.reloads(), 0);
});

test('a failed code-split chunk (error or rejected promise) reloads once', () => {
    const a = run();
    a.fire('error', { target: {}, message: 'ChunkLoadError: Loading chunk 123 failed.' });
    assert.equal(a.reloads(), 1);
    const b = run();
    b.fire('unhandledrejection', { reason: { name: 'TypeError', message: 'Failed to fetch dynamically imported module: /_next/static/x.js' } });
    assert.equal(b.reloads(), 1);
});

test('the script is in the head of every page, and pages are not cached for long', () => {
    assert.ok(fs.readFileSync('src/app/layout.tsx', 'utf8').includes('CHUNK_RECOVERY_SCRIPT'));
    const cfg = fs.readFileSync('next.config.ts', 'utf8');
    assert.ok(cfg.includes('no-cache, must-revalidate') && cfg.includes('_next/static'), 'pages revalidate; build files keep their cache');
});
