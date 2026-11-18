import { RBAC_PERMISSION_DEFINITIONS } from '@/config/rbac-permissions';
import { SIDEBAR_MENU, type MenuItem } from '@/config/sidebar-menu';
import { GUIDE_STAMPS } from './index';
import { guideFingerprint, missingWatchPaths, readSource } from './fingerprint';
import type { ModuleGuide } from './types';

const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => [i, ...flatten(i.submenu ?? [])]);

/** Everything wrong with a guide's own claims (empty when the guide is consistent with the code). */
export function guideProblems(guide: ModuleGuide, root = process.cwd()): string[] {
    const problems: string[] = [];
    const paths = new Set(flatten(SIDEBAR_MENU).map((i) => i.path));
    const codes = new Set<string>(RBAC_PERMISSION_DEFINITIONS.map((d) => d.code));
    const ids = new Set<string>();

    for (const p of missingWatchPaths(guide, root)) problems.push(`watch path does not exist: ${p}`);

    for (const s of guide.sections) {
        const at = `${guide.id}/${s.id}`;
        if (ids.has(s.id)) problems.push(`${at}: duplicate section id`);
        ids.add(s.id);
        if (s.steps.length === 0) problems.push(`${at}: has no steps`);
        if (s.anchors.length === 0) problems.push(`${at}: has no anchors, so nothing ties it to the code`);
        if (s.keywords.length === 0) problems.push(`${at}: has no keywords, so it can never be found`);
        if (s.page && !paths.has(s.page)) problems.push(`${at}: page ${s.page} is not in the sidebar`);
        if (s.requires && !codes.has(s.requires)) problems.push(`${at}: capability ${s.requires} is not in the permission catalog`);
        for (const a of s.anchors) {
            const src = readSource(a.file, root);
            if (src === null) problems.push(`${at}: anchor file is missing: ${a.file}`);
            else if (!src.includes(a.text)) problems.push(`${at}: "${a.text}" is no longer in ${a.file}`);
        }
    }
    return problems;
}

export type GuideFreshness = { id: string; state: 'fresh' | 'stale' | 'unstamped'; current: string; stamped?: string };

/** Whether the code a guide describes has changed since the guide was last reviewed and stamped. */
export function guideFreshness(guide: ModuleGuide, root = process.cwd()): GuideFreshness {
    const current = guideFingerprint(guide, root);
    const stamped = GUIDE_STAMPS[guide.id]?.stamp;
    if (!stamped || stamped === 'pending') return { id: guide.id, state: 'unstamped', current, stamped };
    return { id: guide.id, state: stamped === current ? 'fresh' : 'stale', current, stamped };
}
