export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

/**
 * SSE Route for real-time notifications
 * This route pushes new notifications and cleanly closes before serverless timeout
 * Route: /api/notifications/stream
 */
export const GET = apiHandler(async (req, params) => {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // The authenticated identity is injected by middleware/apiHandler. Never
    // trust a query-string userId for a notification stream.
    const userId = params._userId;

    if (!userId) {
        throw AppError.unauthorized('Missing user authentication');
    }

    let isClosed = false;

    const safeWrite = async (chunk: string) => {
        if (isClosed) return;
        try {
            await writer.write(encoder.encode(chunk));
        } catch {
            isClosed = true;
        }
    };

    // Initialise cleanup dependencies before registering abort handlers. The
    // previous const declarations were below cleanup, so an early disconnect
    // could hit the temporal-dead-zone while the stream was starting.
    const keepAlive = setInterval(() => {
        safeWrite(': keep-alive\n\n');
    }, 15000);
    let unsubscribeUser: () => void = () => {};
    let unsubscribeSystem: () => void = () => {};

    function cleanup() {
        if (isClosed) return;
        isClosed = true;
        clearInterval(keepAlive);
        clearTimeout(maxLifetimeTimeout);
        unsubscribeUser();
        unsubscribeSystem();
        try {
            writer.close();
        } catch {}
    };

    // Subscribe to events
    const { subscribeToNotifications, subscribeToSystemEvents } = await import('@/lib/events');

    unsubscribeUser = subscribeToNotifications(userId, (data) => {
        const payload = JSON.stringify({ ...data, _realtime: true });
        safeWrite(`data: ${payload}\n\n`);
    });

    unsubscribeSystem = subscribeToSystemEvents((data) => {
        const payload = JSON.stringify({ ...data, _isSystem: true });
        safeWrite(`data: ${payload}\n\n`);
    });

    // Gracefully close stream at 50s so serverless function exits cleanly
    // Browser EventSource automatically reconnects without any 504 timeout error in Vercel
    const maxLifetimeTimeout = setTimeout(() => {
        cleanup();
    }, 50000);

    // Handle client disconnect / abort
    req.signal.onabort = () => {
        cleanup();
    };

    // Flush an initial SSE comment immediately. This lets browsers and reverse
    // proxies observe the stream before the 15-second heartbeat, avoiding a
    // false connection failure during the initial handshake.
    await safeWrite(': connected\n\n');

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}, { rawResponse: true });
