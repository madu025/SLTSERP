export const dynamic = 'force-dynamic';

/**
 * Container liveness probe. This must not depend on sync freshness: a delayed
 * external cron tick must never make Docker restart a healthy web process.
 */
export function GET() {
  return Response.json({ status: 'ok' });
}
