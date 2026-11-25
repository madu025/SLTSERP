// Static scan for the high-contrast rule in AGENTS.md: inside ONE className, light text on a light background and dark text on a dark
// background (variants such as hover:, dark:, md: are ignored, so only the base classes are compared).
// It reads className="...", className={`...`} (without ${}), and className={cn(...)} / clsx(...) / twMerge(...), also over several lines;
// the string literals inside cn(...) are joined, so cn("bg-white", "text-white") is found. Classes built at run time are not seen.
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

/** The class names of a cn(...) call: its string literals, joined. Conditional branches (`cond && "..."`, `a ? "x" : "y"`) are left out, so alternatives are not mixed. */
const literalsOf = (args: string): string => {
    const out: string[] = [];
    for (const m of args.matchAll(/(&&|\?|:)?\s*(["'`])((?:(?!\2)[^\\])*)\2/g)) {
        if (m[1]) continue;
        if (m[3].includes('${')) continue;
        out.push(m[3]);
    }
    return out.join(' ');
};

/** The findings of one file's text. */
export function scanText(text: string, file = ''): ContrastFinding[] {
    const out: ContrastFinding[] = [];
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{\s*(?:cn|clsx|twMerge)\(([\s\S]*?)\)\s*\})/g;
    {
        for (const m of text.matchAll(re)) {
            const c = m[1] ?? m[2] ?? (m[3] !== undefined ? literalsOf(m[3]) : '');
            if (c.includes('${')) continue;
            const line = text.slice(0, m.index ?? 0).split('\n').length;
            const base = c.split(/\s+/).filter((x) => x && !x.includes(':') && !x.includes('/'));
            const lightBg = base.some((x) => LIGHT_BG.test(x));
            const darkBg = base.some((x) => DARK_BG.test(x));
            const lightText = base.some((x) => LIGHT_TEXT.test(x));
            const darkText = base.some((x) => DARK_TEXT.test(x));
            const shown = c.replace(/\s+/g, ' ').slice(0, 150);
            if (lightBg && lightText && !darkBg) out.push({ file, line, kind: 'light-on-light', classes: shown });
            if (darkBg && darkText && !lightBg) out.push({ file, line, kind: 'dark-on-dark', classes: shown });
        }
    }
    // A Button or Badge with variant="outline" gets the THEME background (white in the light theme). Light text on it, with no background class of its own,
    // is invisible there (the contractor sign-off "Cancel" button was white on white). One line per tag is enough for the JSX in this project.
    text.split(/\r?\n/).forEach((ln, i) => {
        if (!/variant="outline"/.test(ln)) return;
        const cm = ln.match(/className="([^"]*)"/);
        if (!cm) return;
        const cls = cm[1].split(/\s+/).filter(Boolean);
        if (cls.some((x) => LIGHT_TEXT.test(x.replace(/^!/, ''))) && !cls.some((x) => /^!?bg-/.test(x))) out.push({ file, line: i + 1, kind: 'outline-variant-light-text', classes: cm[1].replace(/\s+/g, ' ').slice(0, 150) });
    });
    return out;
}

export function scan(): ContrastFinding[] {
    return walk('src').flatMap((f) => scanText(fs.readFileSync(f, 'utf8'), f.split(path.sep).join('/')));
}

if (process.argv[1]?.endsWith('contrast-scan.ts')) {
    const r = scan();
    console.log('findings', r.length);
    for (const x of r) console.log(x.kind, x.file + ':' + x.line, '|', x.classes);
}
