import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ModuleGuide } from './types';

/**
 * Fingerprint of the source a guide describes. Used by `pnpm run check:guides` and the unit tests (never at runtime in
 * production, where the sources are not present). Line endings are normalised so Windows and Linux agree.
 */
const IGNORED_DIRS = new Set(['node_modules', '.next', '.git']);
const SOURCE_EXT = /\.(ts|tsx|mts|js|mjs|prisma|json|md|css)$/;

function walk(root: string, path: string, out: string[]) {
    const full = join(root, path);
    if (!existsSync(full)) return;
    if (statSync(full).isFile()) { out.push(path.replace(/\\/g, '/')); return; }
    for (const name of readdirSync(full).sort()) {
        if (IGNORED_DIRS.has(name)) continue;
        const child = join(path, name);
        if (statSync(join(root, child)).isDirectory()) walk(root, child, out);
        else if (SOURCE_EXT.test(name)) out.push(child.replace(/\\/g, '/'));
    }
}

export function guideSourceFiles(guide: ModuleGuide, root = process.cwd()): string[] {
    const files: string[] = [];
    for (const path of guide.watch) walk(root, path, files);
    return [...new Set(files)].sort();
}

export function missingWatchPaths(guide: ModuleGuide, root = process.cwd()): string[] {
    return guide.watch.filter((p) => !existsSync(join(root, p)));
}

export function guideFingerprint(guide: ModuleGuide, root = process.cwd()): string {
    const hash = createHash('sha256');
    for (const file of guideSourceFiles(guide, root)) {
        hash.update(`${relative(root, join(root, file)).replace(/\\/g, '/')}\n`);
        hash.update(readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n'));
        hash.update('\n');
    }
    return hash.digest('hex').slice(0, 16);
}

export function readSource(file: string, root = process.cwd()): string | null {
    const full = join(root, file);
    return existsSync(full) ? readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : null;
}
