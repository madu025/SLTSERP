/**
 * Timezone Utility for Sri Lanka (Asia/Colombo)
 */

/**
 * Returns the current date in Sri Lanka (YYYY-MM-DD format)
 * regardless of the visitor's local computer time.
 */
export function getSriLankaToday(): string {
    const now = new Date();
    // Use Intl to format exactly in SL timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Formats a given date to Sri Lanka Time string
 */
export function formatToSLT(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(d);
}

/**
 * Returns the start of the day in Sri Lanka Timezone as a Date object (UTC)
 */
export function getSriLankaStartOfDay(date: Date | string = new Date()): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    const sltStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);

    // Create a date object for YYYY-MM-DDT00:00:00 in Asia/Colombo
    const [year, month, day] = sltStr.split('-').map(Number);

    // We want the UTC moment that corresponds to 00:00:00 in Colombo
    // Colombo is UTC+5:30. So 00:00 SLT = 18:30 UTC previous day.
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    // Adjust for +5:30 offset to get the correct UTC time
    start.setMinutes(start.getMinutes() - 330);
    return start;
}

/**
 * Returns the end of the day in Sri Lanka Timezone as a Date object (UTC)
 */
export function getSriLankaEndOfDay(date: Date | string = new Date()): Date {
    const start = getSriLankaStartOfDay(date);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return end;
}
