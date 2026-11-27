import { SOD_GUIDE } from './sod.guide';
import { PURCHASE_GUIDE } from './purchase.guide';
import stamps from './guide-stamps.json';
import type { ModuleGuide } from './types';

/**
 * Every module guide. To add a module: write `<module>.guide.ts`, add it here, then run `pnpm run guides:stamp`.
 * See the `update-system-guides` skill for the full routine.
 */
export const GUIDES: readonly ModuleGuide[] = [SOD_GUIDE, PURCHASE_GUIDE];

export const GUIDE_STAMPS = stamps as Record<string, { stamp: string; reviewedAt: string }>;

export type { ModuleGuide, GuideSection, GuideAnchor, GlossaryEntry } from './types';
