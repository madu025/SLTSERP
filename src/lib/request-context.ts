import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
    requestId: string;
    /** Authenticated identity resolved by the server-side session boundary. */
    userId?: string | null;
    userRole?: string | null;
    userName?: string | null;
    permissions?: string[];
    contractorId?: string | null;
    forcePrimary?: boolean;
    /** Timestamp (ms) until which reads should be routed to primary (set after writes) */
    forcePrimaryUntil?: number;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestId() {
    return requestContext.getStore()?.requestId;
}

export function getRequestAuth() {
    const store = requestContext.getStore();
    return {
        userId: store?.userId ?? null,
        userRole: store?.userRole ?? null,
        userName: store?.userName ?? null,
        permissions: store?.permissions ?? [],
        contractorId: store?.contractorId ?? null,
    };
}

export function getAuthenticatedUserId(): string | null {
    return getRequestAuth().userId;
}

