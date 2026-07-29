/**
 * Safe Promise Wrapper (Tuple Error Handling)
 * 
 * Replaces traditional try/catch blocks with a Go-lang style tuple return pattern.
 * This completely eliminates the need for try/catch keywords and untyped 'unknown' errors.
 * 
 * @example
 * const [err, data] = await safe(apiCall());
 * if (err) {
 *    console.error(err.message);
 *    return;
 * }
 * console.log(data);
 */
export function safe<T, E = Error>(promise: Promise<T>): Promise<[E, null] | [null, T]> {
    return promise
        .then(data => [null, data] as [null, T])
        .catch(err => {
            // Ensure the error is an instance of Error
            const errorObj = err instanceof Error ? err : new Error(String(err));
            // Typecast as E to satisfy the return tuple
            return [errorObj as unknown as E, null] as [E, null];
        });
}

/**
 * Synchronous Safe Wrapper (Tuple Error Handling)
 * @example
 * const [err, data] = safeSync(() => JSON.parse(str));
 */
export function safeSync<T, E = Error>(fn: () => T): [E, null] | [null, T] {
    try {
        return [null, fn()];
    } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        return [errorObj as unknown as E, null] as [E, null];
    }
}
