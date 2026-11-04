/**
 * Acceptance evidence for a stage that requires OTDR traces (in-house PAT). Industry FTTH acceptance is
 * evidence-based: every tested fibre must have a trace whose loss is within the design limit. Rules:
 *  - a re-test of the same fibre (same segment, fibre number and wavelength) supersedes the earlier trace, so a
 *    failed first attempt does not block once the fibre has been re-tested and passes;
 *  - a trace counts when its auto result is PASS or a reviewer approved/waived it;
 *  - a rejected trace is a bad file and is ignored; anything else that has not passed blocks the stage.
 */
export interface OtdrEvidenceRow {
    autoResult: string | null;
    status: string;
    cableSegmentId?: string | null;
    fiberNumber?: number | null;
    wavelength?: number | null;
    testDate?: Date | string | null;
    createdAt?: Date | string | null;
}

const when = (row: OtdrEvidenceRow) => new Date(row.testDate ?? row.createdAt ?? 0).getTime();

export function evaluateOtdrEvidence(tests: ReadonlyArray<OtdrEvidenceRow>): { ok: boolean; errors: string[] } {
    const considered = tests.filter((t) => t.status !== 'REJECTED');
    if (considered.length === 0) {
        return { ok: false, errors: ['OTDR evidence is required: upload at least one OTDR trace for this project before the stage can complete.'] };
    }
    // Latest trace per fibre; traces that do not identify a fibre are each judged on their own.
    const latest = new Map<string, OtdrEvidenceRow>();
    considered.forEach((t, index) => {
        const identified = t.fiberNumber != null || t.cableSegmentId;
        const key = identified ? `${t.cableSegmentId ?? '-'}|${t.fiberNumber ?? '-'}|${t.wavelength ?? '-'}` : `anon:${index}`;
        const current = latest.get(key);
        if (!current || when(t) >= when(current)) latest.set(key, t);
    });
    const unresolved = [...latest.values()].filter((t) => !(t.status === 'APPROVED' || t.status === 'WAIVED' || t.autoResult === 'PASS'));
    if (unresolved.length > 0) {
        return { ok: false, errors: [`${unresolved.length} fibre(s) have a failed or unreviewed OTDR trace. Re-test them, or have a reviewer approve or waive the trace with a note.`] };
    }
    return { ok: true, errors: [] };
}
