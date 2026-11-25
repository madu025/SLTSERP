// Static scan for the high-contrast rule in AGENTS.md: inside ONE className string, light text on a light background and dark text on a dark
// background (variants such as hover:, dark:, md: are ignored, so only the base classes are compared).
// usage: pnpm exec tsx scripts/contrast-scan.ts   (lists file:line and the class string)
import fs from 'node:fs';
import path from 'node:path';

const LIGHT_BG = /^bg-(white|slate-50|slate-100|slate-200|gray-50|gray-100|gray-200)$/;
const DARK_BG = /^bg-(slate-900|slate-950|black|gray-900|gray-950|zinc-900|zinc-950)$/;
const LIGHT_TEXT = /^text-(white|slate-100|slate-200|slate-300|gray-100|gray-200)$/;
const DARK_TEXT = /^text-(black|slate-800|slate-900|gray-800|gray-900)$/;

const walk = (d: string, o: string[] = []): string[] => {
    for (const e of fs.readdirSync(d)) {
        const p = path.join(d, e);
        if (fs.statSync(p).isDirectory()) walk(p, o);
        else if (p.endsWith('.tsx')) o.push(p);
    }
    return o;
};

export interface ContrastFinding { file: string; line: number; kind: string; classes: string }

export function scan(): ContrastFinding[] {
    const out: ContrastFinding[] = [];
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
    for (const f of walk('src')) {
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        lines.forEach((l, i) => {
            for (const m of l.matchAll(re)) {
                const c = m[1] ?? m[2] ?? '';
                if (c.includes('${')) continue;
                const base = c.split(/\s+/).filter((x) => x && !x.includes(':') && !x.includes('/'));
                const lightBg = base.some((x) => LIGHT_BG.test(x));
                const darkBg = base.some((x) => DARK_BG.test(x));
                const lightText = base.some((x) => LIGHT_TEXT.test(x));
                const darkText = base.some((x) => DARK_TEXT.test(x));
                if (lightBg && lightText && !darkBg) out.push({ file: f.split(path.sep).join('/'), line: i + 1, kind: 'light-on-light', classes: c.slice(0, 150) });
                if (darkBg && darkText && !lightBg) out.push({ file: f.split(path.sep).join('/'), line: i + 1, kind: 'dark-on-dark', classes: c.slice(0, 150) });
            }
        });
    }
    return out;
}

if (process.argv[1]?.endsWith('contrast-scan.ts')) {
    const r = scan();
    console.log('findings', r.length);
    for (const x of r) console.log(x.kind, x.file + ':' + x.line, '|', x.classes);
}
