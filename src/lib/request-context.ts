import { AsyncLocalStorage } from 'async_hooks';

export const requestContext = new AsyncLocalStorage<{ requestId: string; forcePrimary?: boolean }>();

export function getRequestId() {
    return requestContext.getStore()?.requestId;
}

export function runInRealtimeContext<T>(fn: () => Promise<T>): Promise<T> {
    const store = requestContext.getStore() || { requestId: `realtime-${Date.now()}` };
    return requestContext.run({ ...store, forcePrimary: true }, fn);
}
