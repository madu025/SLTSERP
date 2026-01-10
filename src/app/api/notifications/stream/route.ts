import { NextRequest } from 'next/server';

/**
 * SSE Route for real-time notifications
 * This route remains open and pushes new notifications as they occur
 * Route: /api/notifications/stream
 */
export async function GET(req: NextRequest) {
    // Note: SSE in Next.js App Router requires a specific response format
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // In a real app, get user ID from auth headers/cookies
    // Here we'll assume the frontend passes it for simplicity, 
    // but in a real ERP it MUST be extracted from the session.
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response('Missing userId', { status: 400 });
    }

    // Keep-alive interval
    const keepAlive = setInterval(() => {
        writer.write(encoder.encode(': keep-alive\n\n'));
    }, 30000);

    // Subscribe to events
    // We need to import the subscriber dynamically or ensure lib/events works correctly in this context
    const { subscribeToNotifications } = await import('@/lib/events');

    const unsubscribe = subscribeToNotifications(userId, (data) => {
        const payload = JSON.stringify(data);
        writer.write(encoder.encode(`data: ${payload}\n\n`));
    });

    // Handle close
    req.signal.onabort = () => {
        clearInterval(keepAlive);
        unsubscribe();
        writer.close();
    };

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
