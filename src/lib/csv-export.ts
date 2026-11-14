export type CsvCell = string | number | boolean | null | undefined;

const NEEDS_QUOTES = /[",\r\n]/;
// Spreadsheet formula injection: a text cell that starts with one of these is evaluated by Excel/Sheets.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Escape one field: numbers stay numbers, text is quoted when needed and neutralised if it looks like a formula. */
export function csvField(value: CsvCell): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    let text = String(value);
    if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
    return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
    return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

/** Download rows as a UTF-8 CSV (with BOM so Excel reads non-ASCII text correctly). Browser only. */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
    const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
