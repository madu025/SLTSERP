/**
 * Next.js Instrumentation
 * 
 * This file runs once when the server starts.
 * Use it to initialize background workers and other server-side processes.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initializeBackgroundWorkers } = await import('./workers/init');
        await initializeBackgroundWorkers();
    }
}
