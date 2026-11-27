"use client";

import { PURCHASE_ROUTE, type PurchaseStation } from '@/lib/purchase-flow-gates';
import './purchase-route.css';

/**
 * The compact route of a purchase request (Request -> Stores Manager -> ... -> HO paid), shown on every screen of the flow:
 * passed stations filled, the current one marked with who it waits for.
 */
export default function PurchaseRoute({ station, note }: { station: PurchaseStation; note?: string }) {
    const at = PURCHASE_ROUTE.findIndex((s) => s.key === station);
    const done = station === 'DONE';
    const current = at >= 0 ? PURCHASE_ROUTE[at] : null;
    return (
        <nav className="pr" aria-label="Where this request is">
            <ol>
                {PURCHASE_ROUTE.map((s, i) => {
                    const state = done || (at >= 0 && i < at) ? 'passed' : i === at ? 'here' : 'ahead';
                    return (
                        <li key={s.key} data-state={state} aria-current={state === 'here' ? 'step' : undefined}>
                            <span className="pr-dot" aria-hidden="true" />
                            <span className="pr-label">{s.label}</span>
                        </li>
                    );
                })}
            </ol>
            <p className="pr-note">
                {station === 'CLOSED' ? 'This request is closed.' : done ? 'Paid in full by HO.' : current ? `Waiting for the ${current.who}.` : ''}
                {note ? ` ${note}` : ''}
            </p>
        </nav>
    );
}
