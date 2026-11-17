/**
 * Coalesces identical in-flight GET requests from different components (sidebar hook, header bell, ...)
 * into one network call. `force` always starts a fresh request (used after a write or a server push),
 * and a forced request becomes the one later callers share.
 */
const inflight = new Map<string, Promise<unknown>>();

export function sharedGetJson<T>(url: string, opts: { force?: boolean } = {}): Promise<T | null> {
    const existing = inflight.get(url) as Promise<T | null> | undefined;
    if (existing && !opts.force) return existing;
    const p: Promise<T | null> = fetch(url, { cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
        .catch(() => null)
        .finally(() => { if (inflight.get(url) === p) inflight.delete(url); });
    inflight.set(url, p);
    return p;
}
