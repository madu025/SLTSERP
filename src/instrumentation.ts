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

    console.log('[INSTRUMENTATION] 🚀 Registering server-side processes...');
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[INSTRUMENTATION] 📦 Node.js runtime detected, initializing workers...');
        const { initializeBackgroundWorkers } = await import('./workers/init');
        await initializeBackgroundWorkers();
    }
}
