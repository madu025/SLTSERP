export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

/**
 * SSE Route for real-time notifications
 * This route pushes new notifications and cleanly closes before serverless timeout
 * Route: /api/notifications/stream
 */
export const GET = apiHandler(async (req) => {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const url = new URL(req.url);
    const userId = req.headers.get('x-user-id') || url.searchParams.get('userId');

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

    const cleanup = () => {
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

    // Heartbeat every 15 seconds to keep proxies and intermediaries active
    const keepAlive = setInterval(() => {
        safeWrite(': keep-alive\n\n');
    }, 15000);

    // Subscribe to events
    const { subscribeToNotifications, subscribeToSystemEvents } = await import('@/lib/events');

    const unsubscribeUser = subscribeToNotifications(userId, (data) => {
        const payload = JSON.stringify({ ...data, _realtime: true });
        safeWrite(`data: ${payload}\n\n`);
    });

    const unsubscribeSystem = subscribeToSystemEvents((data) => {
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

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}, { rawResponse: true });
