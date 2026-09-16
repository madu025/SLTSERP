/**
 * Utility for parsing and displaying Previous Return / Re-assigned history on Service Orders.
 * Extracts why and when a SOD was previously returned, ensuring clean display with zero duplicate spam.
 */

export interface PreviousReturnDetails {
    isReassigned: boolean;
    reason: string | null;
    date: string | null;
    displayBadge: string;
    tooltip: string;
}

export function getPreviousReturnDetails(comments: string | null | undefined): PreviousReturnDetails {
    if (!comments) {
        return {
            isReassigned: false,
            reason: null,
            date: null,
            displayBadge: '',
            tooltip: ''
        };
    }

    const isReassigned = comments.includes('[RESTORED')
        || comments.includes('[SYNC-RESTORED]')
        || comments.includes('Prev Return');

    if (!isReassigned) {
        return {
            isReassigned: false,
            reason: null,
            date: null,
            displayBadge: '',
            tooltip: ''
        };
    }

    // Extract Reason
    let reason: string | null = null;
    const reasonMatch = comments.match(/(?:Prev Return Reason:|Prev Return:)\s*([^|\n]+)/i);
    if (reasonMatch && reasonMatch[1]) {
        reason = reasonMatch[1].trim();
    } else {
        const altReasonMatch = comments.match(/Reason:\s*([^|\n]+)/i);
        if (altReasonMatch && altReasonMatch[1]) {
            const raw = altReasonMatch[1].trim();
            if (raw !== 'INPROGRESS' && raw !== 'DISAPPEARED' && raw !== 'PENDING') {
                reason = raw;
            }
        }
    }

    // Extract Date
    let date: string | null = null;
    const dateMatch = comments.match(/(?:Status Date:|Reactivated:|Date:)\s*([^\)\n|]+)/i);
    if (dateMatch && dateMatch[1]) {
        date = dateMatch[1].trim().replace(/\)$/, '');
    }

    // Check for comment note e.g. "Comment: ..."
    let detailNote: string | null = null;
    const commentNoteMatch = comments.match(/Comment:\s*([^\n\[]+)/i);
    if (commentNoteMatch && commentNoteMatch[1]) {
        const note = commentNoteMatch[1].trim();
        if (note.length > 0 && note.length < 80) {
            detailNote = note;
        }
    }

    const cleanReason = reason || (detailNote ? detailNote : 'Previous Return');
    const fullText = detailNote && reason && !reason.includes(detailNote)
        ? `${cleanReason} (${detailNote})`
        : cleanReason;

    const displayDate = date ? ` on ${date}` : '';

    return {
        isReassigned: true,
        reason: fullText,
        date,
        displayBadge: 'RE-ASSIGNED',
        tooltip: `Previously Returned: ${fullText}${displayDate}`
    };
}

/**
 * Deduplicates repeated lines in comments (e.g. repeated [SYNC-RESTORED] log entries).
 */
export function deduplicateCommentLines(comments: string | null | undefined): string | null {
    if (!comments) return null;
    const lines = comments.split('\n').map(l => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniqueLines: string[] = [];
    for (const line of lines) {
        if (!seen.has(line)) {
            seen.add(line);
            uniqueLines.push(line);
        }
    }
    return uniqueLines.length > 0 ? uniqueLines.join('\n') : null;
}
