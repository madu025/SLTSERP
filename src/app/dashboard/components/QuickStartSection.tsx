"use client";

import Link from 'next/link';
import { quickStartLinks } from '@/config/dashboard-quick-start';

/** The dashboard of a person with no dashboard tab: the places they work in. */
export default function QuickStartSection({ permissions }: { permissions: readonly string[] | undefined }) {
    const links = quickStartLinks(permissions);
    return (
        <section aria-label="Where you work" className="space-y-4">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Where you work</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">The pages your job uses. The menu on the left has the same pages.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((l) => (
                    <Link key={l.href} href={l.href} className="block rounded-2xl border border-slate-300 bg-white p-5 shadow-sm transition hover:border-indigo-600 hover:shadow-md">
                        <p className="text-base font-bold text-slate-900">{l.title}</p>
                        <p className="mt-1 text-sm text-slate-700">{l.description}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
