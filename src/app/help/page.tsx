"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { GUIDES, GUIDE_STAMPS } from "@/content/guides";
import { pageTrail } from "@/services/guides/guide.service";
import { RBAC_PERMISSION_DEFINITIONS } from "@/config/rbac-permissions";

const CAPABILITY_TEXT = new Map(RBAC_PERMISSION_DEFINITIONS.map((d) => [d.code as string, d.description]));
// the purchase flow first: it is the guide most staff need
const ORDERED = [...GUIDES].sort((a, b) => (a.id === "purchase" ? -1 : b.id === "purchase" ? 1 : 0));

/**
 * Help: the step-by-step system guides (src/content/guides), the same text the Nexus assistant answers from. Each guide is checked
 * against the screens by the unit tests, so it shows the real labels. A section says whether the reader may do it.
 */
export default function HelpPage() {
    const [guideId, setGuideId] = useState(ORDERED[0]?.id ?? "");
    const [q, setQ] = useState("");
    const [mine, setMine] = useState(false);
    const [perms] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return new Set();
        try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return new Set(Array.isArray(u.permissions) ? u.permissions : []); } catch { return new Set(); }
    });
    const guide = ORDERED.find((g) => g.id === guideId) ?? ORDERED[0];
    const sections = useMemo(() => {
        const t = q.trim().toLowerCase();
        return guide.sections.filter((s) => (!mine || !s.requires || perms.has(s.requires))
            && (!t || [s.title, s.summary, ...s.steps, ...(s.tips ?? []), ...s.keywords].some((x) => x.toLowerCase().includes(t))));
    }, [guide, q, mine, perms]);
    const reviewed = GUIDE_STAMPS[guide.id]?.reviewedAt;

    return (
        <RoleGuard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" data-testid="help-page">
            <div>
                <h1 className="text-2xl font-black text-slate-900">Help</h1>
                <p className="max-w-3xl text-sm text-slate-700">Step-by-step guides written from the real screens. Each step names the button you click. You can also ask the Nexus assistant, for example &quot;how do I record a GRN&quot;.</p>
                <p className="max-w-3xl text-sm text-slate-700">පියවරෙන් පියවර උපදෙස්. ඔබට කළ හැකි කොටස් &quot;You can do this&quot; ලෙස පෙන්වයි.</p>
            </div>

            <div role="tablist" aria-label="Guides" className="flex flex-wrap gap-2">
                {ORDERED.map((g) => (
                    <button key={g.id} type="button" role="tab" aria-selected={g.id === guide.id} data-testid={`help-guide-${g.id}`} onClick={() => setGuideId(g.id)}
                        className={`rounded-md border px-3 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${g.id === guide.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"}`}>
                        {g.title}
                    </button>
                ))}
            </div>

            <section className="rounded-lg border border-slate-300 bg-white p-4">
                <h2 className="text-lg font-black text-slate-900">{guide.title}</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-800">{guide.purpose}</p>
                {reviewed && <p className="mt-1 text-xs text-slate-700">Checked against the screens on {reviewed}.</p>}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col text-xs font-semibold text-slate-800">Find a step
                        <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="help-search" className="mt-1 w-72 max-w-full rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900" />
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4" data-testid="help-mine" /> Only what I can do
                    </label>
                </div>
            </section>

            <nav aria-label="Topics" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {sections.map((s) => <a key={s.id} href={`#${s.id}`} className="font-semibold text-blue-800 underline">{s.title}</a>)}
            </nav>

            {sections.length === 0 && <p className="text-sm text-slate-800">No step matches. Clear the search or untick &quot;Only what I can do&quot;.</p>}
            {sections.map((s) => {
                const can = !s.requires || perms.has(s.requires);
                const where = pageTrail(s.page);
                return (
                    <article key={s.id} id={s.id} data-testid="help-section" className="scroll-mt-4 rounded-lg border border-slate-300 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-base font-black text-slate-900">{s.title}</h3>
                            {s.requires && (
                                <span className={`rounded border px-2 py-0.5 text-xs font-bold ${can ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-100 text-slate-800"}`}>
                                    {can ? "You can do this" : "Done by another role"}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-slate-800">{s.summary}</p>
                        {where && <p className="mt-1 text-sm text-slate-800">Where: {s.page && can ? <Link href={s.page} className="font-semibold text-blue-800 underline">{where}</Link> : <b>{where}</b>}</p>}
                        <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm text-slate-900">
                            {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                        </ol>
                        {s.tips && s.tips.length > 0 && (
                            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                                <p className="text-xs font-bold text-amber-900">Good to know</p>
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-950">{s.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                            </div>
                        )}
                        {s.images && s.images.length > 0 && (
                            <div className={`mt-3 grid grid-cols-1 gap-3 ${s.images.length > 1 ? "lg:grid-cols-2" : ""}`}>
                                {s.images.map((im) => (
                                    <figure key={im.src} data-testid="help-shot" className="rounded-md border border-slate-300 bg-slate-50 p-2">
                                        {/* a screenshot of the real screen on test data; opens full size in a new tab */}
                                        <a href={im.src} target="_blank" rel="noreferrer" aria-label={`Open the screenshot full size: ${im.caption}`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={im.src} alt={im.caption} loading="lazy" width={1366} height={768} className="h-auto w-full rounded border border-slate-200" />
                                        </a>
                                        <figcaption className="mt-1.5 text-xs text-slate-800">{im.caption}</figcaption>
                                    </figure>
                                ))}
                            </div>
                        )}
                        {s.requires && !can && <p className="mt-2 text-xs text-slate-700">Needs: {CAPABILITY_TEXT.get(s.requires) ?? s.requires}</p>}
                    </article>
                );
            })}

            {guide.glossary.length > 0 && (
                <section className="rounded-lg border border-slate-300 bg-white p-4">
                    <h3 className="text-base font-black text-slate-900">Words used</h3>
                    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
                        {guide.glossary.map((g) => (
                            <div key={g.term} className="contents"><dt className="font-bold text-slate-900">{g.term}</dt><dd className="text-slate-800">{g.meaning}</dd></div>
                        ))}
                    </dl>
                </section>
            )}
        </div>
        </main>
        </div>
        </div>
        </RoleGuard>
    );
}
