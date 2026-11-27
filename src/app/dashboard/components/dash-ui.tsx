"use client";

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export type DashTone = 'wait' | 'fault' | 'pass' | 'route' | 'neutral';

/** A section title and one plain line saying what it answers. */
export function DashHeading({ title, note }: { title: string; note?: string }) {
    return (
        <div className="dash-heading">
            <h2>{title}</h2>
            {note && <p>{note}</p>}
        </div>
    );
}

/** A quiet number: label, value, hint. Links when it has somewhere to go. */
export function DashFigure({ label, value, hint, href, tone = 'neutral', icon, children }: { label: string; value?: ReactNode; hint?: ReactNode; href?: string; tone?: DashTone; icon?: ReactNode; children?: ReactNode }) {
    const body = (
        <>
            <div className="dash-figure-label">{icon}{label}</div>
            {value !== undefined && <div className="dash-figure-value">{value}</div>}
            {hint && <p className="dash-figure-hint">{hint}</p>}
            {children}
        </>
    );
    return href
        ? <Link href={href} className="dash-figure" data-tone={tone}>{body}</Link>
        : <div className="dash-figure" data-tone={tone}>{body}</div>;
}

export interface Station { label: string; value: number; hint?: ReactNode; href?: string; tone?: DashTone; /** counts toward "most orders wait here" */ waiting?: boolean }

/** Index of the waiting station holding the most orders, or -1 when none waits. */
export function busiestStation(stations: Station[]): number {
    let best = -1;
    stations.forEach((s, i) => { if (s.waiting && s.value > 0 && (best === -1 || s.value > stations[best].value)) best = i; });
    return best;
}

/** The order pipeline drawn as a route with stations, in the order the orders travel. The busiest waiting station is marked. */
export function RouteStrip({ title, note, stations }: { title: string; note?: ReactNode; stations: Station[] }) {
    const busiest = busiestStation(stations);
    return (
        <section className="dash-route" aria-label={title}>
            <div className="dash-route-head">
                <h3>{title}</h3>
                {note && <p>{note}</p>}
            </div>
            <ol style={{ '--dash-stations': stations.length } as CSSProperties}>
                {stations.map((s, i) => {
                    const inner = (
                        <>
                            <div className="dash-station-label">{s.label}</div>
                            <div className="dash-station-value">{s.value.toLocaleString('en-LK')}</div>
                            {s.hint && <p className="dash-station-hint">{s.hint}</p>}
                            {i === busiest && <span className="dash-station-flag">Most orders wait here</span>}
                        </>
                    );
                    const attrs = { className: 'dash-station', 'data-tone': s.tone ?? 'route', 'data-busiest': i === busiest ? 'true' : 'false' };
                    return <li key={s.label}>{s.href ? <Link href={s.href} {...attrs}>{inner}</Link> : <div {...attrs}>{inner}</div>}</li>;
                })}
            </ol>
        </section>
    );
}
