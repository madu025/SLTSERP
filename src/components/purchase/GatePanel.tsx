"use client";

import { CheckCircle2, XCircle } from 'lucide-react';
import type { GateCheck } from '@/lib/purchase-flow-gates';
import './purchase-form.css';

/**
 * "Before you confirm": the checks of a purchase-flow step, live, and the one action of the screen, locked until all pass.
 * The same checks are thrown by the service (lib/purchase-flow-gates.ts), so the screen and the server never disagree.
 */
export default function GatePanel({ checks, action, onAction, busy, testId }: { checks: GateCheck[]; action: string; onAction: () => void; busy?: boolean; testId?: string }) {
    const left = checks.filter((c) => !c.ok).length;
    return (
        <aside className="pf-gate" aria-label="Checks before saving">
            <h2>Before you confirm</h2>
            <p>The same checks the system makes when you save.</p>
            <ul className="pf-checks" aria-live="polite">
                {checks.map((c) => (
                    <li key={c.key} data-ok={c.ok}>
                        {c.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                        <span>{c.text}</span>
                    </li>
                ))}
            </ul>
            <div className="pf-gate-foot">
                <span className="pf-status" data-ok={left === 0} role="status">{left === 0 ? 'Ready' : `${left} check${left === 1 ? '' : 's'} to complete`}</span>
                <button type="button" className="pf-go" data-testid={testId} disabled={left > 0 || busy} onClick={onAction}>{busy ? 'Saving...' : action}</button>
            </div>
        </aside>
    );
}
