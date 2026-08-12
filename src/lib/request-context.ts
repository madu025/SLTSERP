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

