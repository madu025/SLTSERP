/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WebSocket Fallback for SSE Notifications
 * Provides real-time notification delivery via WebSocket when SSE is unreliable.
 * Uses Next.js Edge compatible WebSocket handling.
 */

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// WebSocket upgrade handler
export const GET = apiHandler(async (req) => {
    const isDeno = typeof (globalThis as any).Deno !== 'undefined';
    const { socket: ws, response } = isDeno
        ? await (globalThis as any).Deno.upgradeWebSocket(req)
        : { socket: null, response: null };

    // Deno upgrade
    if (ws) {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            throw AppError.badRequest('userId required');
        }

        ws.onopen = () => {
            console.log(`[WS] User ${userId} connected`);
            // Send initial connection confirmation
            ws.send(JSON.stringify({ type: 'connected', userId }));
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                // Handle client pings
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch {
                // Ignore unparseable messages
            }
        };

        ws.onerror = (error: Event) => {
            console.error(`[WS] Error for user ${userId}:`, error);
        };

        // Keep-alive ping every 30 seconds
        const keepAlive = setInterval(() => {
            if (ws.readyState === (ws as any).OPEN) {
                ws.send(JSON.stringify({ type: 'keepalive', timestamp: Date.now() }));
            }
        }, 30000);

        ws.onclose = () => {
            console.log(`[WS] User ${userId} disconnected`);
            clearInterval(keepAlive);
        };

        return response;
    }

    // Fallback: SSE-based fallback response
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        throw AppError.badRequest('userId required');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            // Send initial event
            const initMsg = JSON.stringify({ type: 'connected', userId, transport: 'sse-fallback' });
            controller.enqueue(encoder.encode(`data: ${initMsg}\n\n`));

            // Keep-alive interval
            const keepAlive = setInterval(() => {
                const ping = JSON.stringify({ type: 'keepalive', timestamp: Date.now() });
                controller.enqueue(encoder.encode(`data: ${ping}\n\n`));
            }, 15000);

            req.signal.addEventListener('abort', () => {
                clearInterval(keepAlive);
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}, { rawResponse: true });

// Handle CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}