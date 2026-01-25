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
