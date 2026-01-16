import { requestContext } from './request-context';
import { NextRequest } from 'next/server';

type ApiHandler = (request: NextRequest, ...args: unknown[]) => Promise<Response>;

export function withTracing(handler: ApiHandler): ApiHandler {
    return async (request: NextRequest, ...args: unknown[]) => {
        const requestId = request.headers.get('x-request-id') || 'internal-' + Math.random().toString(36).substring(7);
        return requestContext.run({ requestId }, () => handler(request, ...args));
    };
}
