import type { RbacPermission } from '@/config/rbac-permissions';

/**
 * System guides: step-by-step help for new staff, written from the application's own screens.
 *
 * A guide is only allowed to say what the code does. Two checks keep it honest:
 *  - every `anchor` is a piece of text (a button, a title, a rule) that must still exist in the named source file,
 *    so renaming or removing something the guide mentions fails the unit tests;
 *  - every guide lists the source files it describes (`watch`). `pnpm run check:guides` fingerprints them, and a
 *    guide whose files changed since it was last reviewed is reported as stale until it is reviewed and re-stamped.
 */
export interface GuideAnchor {
    /** Repo-relative file the guide text relies on. */
    file: string;
    /** Exact text that must appear in that file. */
    text: string;
}

export interface GuideSection {
    /** Stable id, unique inside the guide. */
    id: string;
    title: string;
    /** One sentence: what this is for. */
    summary: string;
    /** Words people use when they ask (English, Sinhala or Singlish). Used for matching. */
    keywords: string[];
    /** The page where this happens (a sidebar path). */
    page?: string;
    /** Capability the user needs to do this. If they lack it the guide says so instead of teaching it. */
    requires?: RbacPermission;
    /** Who this is for when it is not an office user (for example contractor logins). */
    audience?: 'office' | 'contractor';
    /** Numbered, imperative steps using the exact labels on screen. */
    steps: string[];
    /** Things that commonly go wrong or are easy to miss. */
    tips?: string[];
    /** Screenshots of the real screen at this step (files under public/, shown on Help). Taken on test data, never real ERP data. */
    images?: { src: string; caption: string }[];
    /** Text from the source that this section relies on (checked by the unit tests). */
    anchors: GuideAnchor[];
}

export interface GlossaryEntry { term: string; meaning: string }

export interface ModuleGuide {
    /** Short stable id, also the key in guide-stamps.json. */
    id: string;
    title: string;
    /** What the module is for, in two or three sentences. */
    purpose: string;
    /** Source files and folders this guide describes (folders are scanned recursively). */
    watch: string[];
    glossary: GlossaryEntry[];
    sections: GuideSection[];
}
