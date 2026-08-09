import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
    requestId: string;
    forcePrimary?: boolean;
    /** Timestamp (ms) until which reads should be routed to primary (set after writes) */
    forcePrimaryUntil?: number;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestId() {
    return requestContext.getStore()?.requestId;
}

/**
 * Route all reads to the primary DB within this scope.
 * Use after a write to avoid stale reads from replica lag.
 */
export function withPrimaryRead<T>(fn: () => Promise<T>): Promise<T> {
    const store = requestContext.getStore() || { requestId: `standalone-${Date.now()}` };
    return requestContext.run({ ...store, forcePrimary: true }, fn);
}
