/**
 * Next.js Instrumentation
 * 
 * This file runs once when the server starts.
 * Use it to initialize background workers and other server-side processes.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Skip initialization during build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    // Skip worker initialization when running in Vercel Serverless environment
    if (process.env.VERCEL === '1') {
        console.log('[INSTRUMENTATION] ❄️ Vercel Serverless environment detected, skipping background worker initialization.');
        return;
    }

    console.log('[INSTRUMENTATION] 🚀 Registering server-side processes...');
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[INSTRUMENTATION] 📦 Node.js runtime detected, initializing workers...');
        const { initializeBackgroundWorkers } = await import('./workers/init');
        await initializeBackgroundWorkers();

        console.log('[INSTRUMENTATION] 🔔 Registering event-driven subscribers...');
        const { registerSODEventHandlers } = await import('./lib/events/sod-handlers');
        const { registerOtherEventHandlers } = await import('./lib/events/other-handlers');
        registerSODEventHandlers();
        registerOtherEventHandlers();
    }
}
