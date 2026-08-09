import { requestContext } from './request-context';

/**
 * Wrap a raw Next.js route handler with AsyncLocalStorage request context.
 * Routes using `apiHandler` already get this automatically -- this utility
 * is for the ~399 raw route handlers that do not go through `apiHandler`.
 *
 * Usage:
 * ```ts
 * export async function GET(req: Request) {
 *   return withRequestContext(req, async () => {
 *     // logger.info('...') now shows [ReqID: <uuid>]
 *     // prisma reads can access requestId for correlation
 *     return NextResponse.json({ ok: true });
 *   });
 * }
 * ```
 */
export function withRequestContext<T>(req: Request, handler: () => Promise<T>): Promise<T> {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    return requestContext.run({ requestId }, handler);
}
