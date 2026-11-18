/** The first figure in an alert sentence, shown big so the card can be read in a second: "-1,665,828" becomes "-1.67 M". */
export function headlineFigure(detail: string): string | null {
    const m = detail.match(/-?\d[\d,]*(?:\.\d+)?%?/);
    if (!m) return null;
    const raw = m[0];
    if (raw.endsWith('%')) return raw;
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n)) return null;
    const a = Math.abs(n);
    if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
    if (a >= 100_000) return `${Math.round(n / 1000).toLocaleString('en-US')} K`;
    return n.toLocaleString('en-US');
}
