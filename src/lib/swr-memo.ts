/**
 * Small in-process stale-while-revalidate memo for expensive, read-only aggregates.
 *
 * - Fresh entries (younger than `freshMs`) are returned straight away.
 * - Stale entries (younger than `staleMs`) are returned straight away too, while one background
 *   refresh runs, so a user never waits for the heavy computation after the first load.
 * - Concurrent callers for the same key share a single in-flight computation.
 *
 * The key MUST contain everything that changes the result (user id, permission set, scope), so the
 * cache can never hand one caller another caller's data.
 */
interface Entry<T> { value: T; at: number }

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 200;

export async function swrMemo<T>(key: string, freshMs: number, staleMs: number, compute: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = store.get(key) as Entry<T> | undefined;

    const run = (): Promise<T> => {
        const existing = inflight.get(key) as Promise<T> | undefined;
        if (existing) return existing;
        const p = compute()
            .then((value) => {
                if (store.size >= MAX_ENTRIES) {
                    const oldest = store.keys().next().value;
                    if (oldest !== undefined) store.delete(oldest);
                }
                store.set(key, { value, at: Date.now() });
                return value;
            })
            .finally(() => { inflight.delete(key); });
        inflight.set(key, p);
        return p;
    };

    if (hit && now - hit.at < freshMs) return hit.value;
    if (hit && now - hit.at < staleMs) {
        void run().catch(() => undefined); // refresh in the background; keep serving the stale copy
        return hit.value;
    }
    return run();
}
