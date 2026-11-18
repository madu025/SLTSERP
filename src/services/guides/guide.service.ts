import { GUIDES, GUIDE_STAMPS, type GlossaryEntry, type GuideSection, type ModuleGuide } from '@/content/guides';
import { RBAC_PERMISSION_DEFINITIONS } from '@/config/rbac-permissions';
import { SIDEBAR_MENU, type MenuItem } from '@/config/sidebar-menu';

export interface GuideSectionAnswer {
    id: string;
    title: string;
    summary: string;
    /** Where to click, from the real sidebar (for example "Service Orders → Pending SOD"). */
    where?: string;
    steps: string[];
    tips: string[];
    /** Set when the caller lacks the capability: the steps are withheld and this says what is missing. */
    blocked?: string;
}

export interface GuideAnswer {
    kind: 'guide';
    guide: string;
    purpose: string;
    reviewedAt: string;
    matched: boolean;
    sections: GuideSectionAnswer[];
    glossary: GlossaryEntry[];
    /** Other topics in the same guide, so the reader knows what else to ask. */
    otherTopics: string[];
}

const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'who', 'can', 'does', 'do', 'to', 'in', 'of', 'a', 'an', 'is', 'are', 'me', 'my', 'i', 'it', 'this', 'that', 'with', 'on', 'at', 'new', 'staff', 'please', 'tell', 'show', 'explain', 'guide', 'help', 'about', 'system', 'module', 'member', 'person', 'someone', 'employee', 'user', 'users', 'beginner', 'newcomer', 'joiner', 'everything', 'whole', 'overall', 'basics', 'basic']);

/** The module's own name: it appears in nearly every question, so it says nothing about WHICH topic is wanted. */
const MODULE_WORDS = new Set(['sod', 'sods', 'service', 'order', 'orders', 'module']);
/** Verbs and fillers (English and Singlish) that fit any topic. They never decide a match on their own. */
const WEAK_WORDS = new Set(['create', 'make', 'open', 'use', 'using', 'work', 'works', 'working', 'change', 'set', 'doing', 'done', 'get', 'start', 'eka', 'ekata', 'ekak', 'kenekta', 'kenek', 'kohomada', 'karanne', 'karanna', 'karamu', 'hadanne', 'hadanna', 'mokakda', 'mokada', 'monawada', 'thiyenawada', 'kiyala', 'kiyanna', 'balanna', 'penwanna', 'denna', 'wage', 'nam', 'not', 'see', 'why', 'cannot', 'cant']);

const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t) && (t.length > 2 || ['pat', 'sod', 'ont', 'stb', 'dp', 'ho'].includes(t)));

/** The deepest menu path that leads to `path` (a parent menu often shares its first child's path). */
function trail(items: MenuItem[], path: string, parents: string[] = []): string[] | null {
    let best: string[] | null = null;
    for (const item of items) {
        const here = [...parents, item.title];
        const found = item.submenu ? trail(item.submenu, path, here) : null;
        const candidate = found ?? (item.path === path ? here : null);
        if (candidate && (!best || candidate.length > best.length)) best = candidate;
    }
    return best;
}

/** "Service Orders → Pending SOD" built from the real sidebar, so it can never describe a menu that does not exist. */
export function pageTrail(path: string | undefined): string | undefined {
    if (!path) return undefined;
    const found = trail(SIDEBAR_MENU, path);
    return found ? found.join(' → ') : undefined;
}

const vocabCache = new Map<string, Set<string>>();
/** Every word the guide uses anywhere. A question about words the guide never uses is not covered by it. */
function vocabulary(guide: ModuleGuide): Set<string> {
    let v = vocabCache.get(guide.id);
    if (!v) {
        v = new Set<string>();
        const add = (t: string) => tokens(t).forEach((w) => v!.add(w));
        add(guide.purpose);
        guide.glossary.forEach((g) => { add(g.term); add(g.meaning); });
        guide.sections.forEach((s) => { add(s.title); add(s.summary); s.keywords.forEach(add); s.steps.forEach(add); (s.tips ?? []).forEach(add); });
        vocabCache.set(guide.id, v);
    }
    return v;
}

/** Share of the question's subject words that the section itself talks about. */
function coverage(section: GuideSection, subject: string[]): number {
    if (subject.length === 0) return 1;
    const own = new Set([section.title, section.summary, ...section.keywords, ...section.steps, ...(section.tips ?? [])].flatMap((t) => tokens(t)));
    return subject.filter((t) => own.has(t)).length / subject.length;
}

function score(section: GuideSection, query: string, queryTokens: string[]): number {
    let s = 0;
    for (const phrase of section.keywords) {
        const own = tokens(phrase);
        if (phrase.includes(' ') && own.some((w) => !MODULE_WORDS.has(w)) && query.includes(phrase)) s += 4;
    }
    const kw = new Set(section.keywords.flatMap((k) => tokens(k)));
    const title = new Set(tokens(section.title));
    const summary = new Set(tokens(section.summary));
    for (const t of queryTokens) {
        if (MODULE_WORDS.has(t)) continue;
        const weak = WEAK_WORDS.has(t) ? 0.34 : 1;
        if (kw.has(t)) s += 3 * weak;
        if (title.has(t)) s += 2 * weak;
        if (summary.has(t)) s += 1 * weak;
    }
    return s;
}

function capabilityLabel(code: string): string {
    const def = RBAC_PERMISSION_DEFINITIONS.find((d) => d.code === code);
    return def ? `${def.description} (${code})` : code;
}

function answerSection(section: GuideSection, permissions: ReadonlySet<string>): GuideSectionAnswer {
    const blocked = section.requires && !permissions.has(section.requires)
        ? `Your account does not have access to this. It needs: ${capabilityLabel(section.requires)}. Ask your administrator if you should have it.`
        : undefined;
    return {
        id: section.id,
        title: section.title,
        summary: section.summary,
        where: pageTrail(section.page),
        steps: blocked ? [] : section.steps,
        tips: blocked ? [] : section.tips ?? [],
        blocked,
    };
}

export class GuideService {
    static modules(): Array<{ id: string; title: string }> {
        return GUIDES.map((g) => ({ id: g.id, title: g.title }));
    }

    /**
     * Finds the guide sections that answer `topic`. Only text written in the guides is returned, so the answer can never
     * be invented; when nothing matches it says so and lists what the guide covers.
     */
    static lookup(topic: string | undefined, permissions: ReadonlySet<string>, moduleId?: string): GuideAnswer {
        const pool: ModuleGuide[] = moduleId ? GUIDES.filter((g) => g.id === moduleId) : [...GUIDES];
        const guides = pool.length > 0 ? pool : [...GUIDES];
        const query = String(topic ?? '').toLowerCase().trim();
        const queryTokens = tokens(query);

        const ranked = guides
            .flatMap((guide) => guide.sections.map((section) => ({ guide, section, s: score(section, query, queryTokens) })))
            .filter((r) => r.s >= 3)
            .sort((a, b) => b.s - a.s);

        // One answer is about one guide: take the best match's guide.
        const guide = ranked[0]?.guide ?? guides[0];
        // Words that name the subject. If most of them are words this guide never uses, the question is about something
        // else (for example projects), and a stray shared word like "assign" must not make the guide look relevant.
        const subject = queryTokens.filter((t) => !MODULE_WORDS.has(t) && !WEAK_WORDS.has(t));
        const known = subject.filter((t) => vocabulary(guide).has(t)).length;
        const unrelated = subject.length > 0 && subject.length - known >= known;
        const best = unrelated ? Infinity : ranked[0]?.s ?? 0;
        // Only sections that match about as well as the best one: a stray shared word must not pull in other topics.
        // ...and the section must actually talk about the question's subject, not just share one word with it.
        const hits = ranked.filter((r) => r.guide.id === guide.id && r.s >= best * 0.6 && coverage(r.section, subject) >= (subject.length <= 3 ? 1 : 0.75)).slice(0, 3);
        // A question about the module as a whole ("explain SOD to a new person") gets the overview first.
        const generic = queryTokens.every((t) => MODULE_WORDS.has(t) || WEAK_WORDS.has(t));
        const sections = (generic || hits.length === 0 ? guide.sections.filter((s) => s.id === 'overview') : hits.map((h) => h.section));

        const glossary = guide.glossary.filter((g) => {
            const t = g.term.toLowerCase();
            return generic || hits[0]?.section.id === 'overview' || t.split(/[^a-z0-9]+/).some((p) => p.length > 1 && queryTokens.includes(p));
        });
        const shownIds = new Set(sections.map((s) => s.id));
        const matched = hits.length > 0 || (generic && !unrelated);
        return {
            kind: 'guide',
            guide: guide.title,
            purpose: guide.purpose,
            reviewedAt: GUIDE_STAMPS[guide.id]?.reviewedAt ?? 'unknown',
            matched,
            sections: matched ? sections.map((s) => answerSection(s, permissions)) : [],
            glossary: matched ? glossary : [],
            otherTopics: guide.sections.filter((s) => !matched || !shownIds.has(s.id)).map((s) => s.title),
        };
    }
}
