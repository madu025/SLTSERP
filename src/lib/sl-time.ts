/**
 * Sri Lanka business time (Asia/Colombo, UTC+5:30, no daylight saving). Timestamps are stored in UTC, but a
 * "day" or "month" in a report means the Colombo day or month. Computing bounds on UTC instead shifts every
 * boundary by 5h30m, so an order completed at 01:00 on the 1st counted in the previous month.
 *
 * `slWall(d)` gives a Date whose UTC fields read as the Colombo wall clock; `slInstant(y, m, d)` is the real
 * instant of Colombo midnight (month and day may overflow, as with Date.UTC).
 */
export const SL_OFFSET_MS = 330 * 60_000;

export const slWall = (d: Date): Date => new Date(d.getTime() + SL_OFFSET_MS);
export const slInstant = (year: number, month: number, day = 1): Date => new Date(Date.UTC(year, month, day) - SL_OFFSET_MS);
/** YYYY-MM-DD of the Colombo calendar day containing the instant. */
export const slDayKey = (d: Date): string => slWall(d).toISOString().slice(0, 10);
export const slDaysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
/** Start of the Colombo day for a YYYY-MM-DD string. */
export const slStartOfDayKey = (key: string): Date => { const [y, m, d] = key.split('-').map(Number); return slInstant(y, m - 1, d); };
