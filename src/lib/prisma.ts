import { PrismaClient } from '@prisma/client'
import { logger } from './logger'
import { getRequestId, requestContext } from './request-context'

/**
 * Duration (ms) after a write during which reads are routed to the primary
 * instead of the replica.  Covers typical Supabase replication lag.
 * Override via REPLICA_LAG_WINDOW_MS env var.
 */
const REPLICA_LAG_WINDOW_MS = parseInt(process.env.REPLICA_LAG_WINDOW_MS || '2000', 10);

/**
 * Connection budget - the pooler ceiling is project-wide, not per process.
 *
 * Supabase's session-mode pooler caps `pool_size` SERVER connections for the whole project (15
 * today) and holds one server connection per client connection, so every process that talks to
 * this DB shares that single ceiling: the VPS web+worker process, Vercel lambdas, local `next dev`,
 * migrations and one-off scripts. A client asking for more sessions than its share does not go
 * faster - it makes every other process fail with EMAXCONNSESSION (and a limit above the ceiling
 * guarantees it). Limits are therefore shares of the ceiling, never a free number.
 *
 * Share when nothing is overridden: worker 4 | persistent web 4 | serverless per instance 3 |
 * local dev 2. Raise a host's share with DB_CONNECTION_LIMIT (capped by DB_POOL_CEILING) once the
 * project's pool_size actually grows.
 */
const POOL_CEILING = parseInt(process.env.DB_POOL_CEILING || '15', 10);

function connectionShare(isWorker: boolean): number {
    const forced = parseInt(process.env.DB_CONNECTION_LIMIT || '0', 10);
    const share = Number.isFinite(forced) && forced > 0 ? forced
        : isWorker ? 4
            : process.env.VERCEL === '1' ? 3
                : process.env.NODE_ENV === 'production' ? 4
                    : 2;
    // An oversized share is the bug being fixed, so clamp instead of trusting the env value.
    return Math.max(1, Math.min(share, POOL_CEILING));
}

/**
 * Utility to sanitize and optimize DB URLs (timeouts, pooling)
 */
const getSafeDatabaseUrl = (url: string, isWorker: boolean = false) => {
    if (!url) return url;
    try {
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has('statement_timeout')) {
            urlObj.searchParams.set('statement_timeout', '30000'); // 30s timeout
        }
        if (!urlObj.searchParams.has('connect_timeout')) {
            urlObj.searchParams.set('connect_timeout', '10'); // 10s connection timeout
        }
        const share = connectionShare(isWorker);
        const urlLimit = parseInt(urlObj.searchParams.get('connection_limit') || '0', 10);
        // The URL may only ever lower the share, never raise it: env files were previously the
        // path by which a 15-session pooler got asked for 20 or 50 connections.
        urlObj.searchParams.set('connection_limit', String(urlLimit > 0 ? Math.min(urlLimit, share) : share));
        // Waiting for a borrowed session is correct; opening an extra one is what breaks the host.
        urlObj.searchParams.set('pool_timeout', String(isWorker ? 60 : process.env.NODE_ENV === 'production' ? 30 : 10));
        return urlObj.toString();
    } catch {
        return url;
    }
}

/**
 * Identity of a database, ignoring query params. Two URLs that differ only by `connection_limit`
 * point at the same Postgres; treating them as separate hosts used to open a second client whose
 * sessions bought zero read scaling.
 */
const dbIdentity = (url: string | undefined): string => {
    if (!url) return '';
    try {
        const u = new URL(url);
        return `${u.hostname}:${u.port}${u.pathname}`.toLowerCase();
    } catch {
        return '';
    }
}

const isWorker = process.env.IS_WORKER === 'true';
const replicaConfigured = !!process.env.READ_REPLICA_URL;

// 1. Initialize Primary Connection (Write/Master)
const primaryUrl = getSafeDatabaseUrl(process.env.DATABASE_URL || '', isWorker);

const globalForPrisma = globalThis as unknown as {
    primaryClient: PrismaClient | undefined;
    readClient: PrismaClient | undefined;
}

const primaryClient = globalForPrisma.primaryClient ?? new PrismaClient({
    datasources: primaryUrl ? { db: { url: primaryUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

globalForPrisma.primaryClient = primaryClient;

// 2. Initialize Read Replica Connection (Optional)
// Only a genuinely different database earns a second client: a replica URL that differs from the
// primary by query params alone is the same Postgres, and a second client there just burns sessions
// from the shared pooler ceiling (that duplicate cost the VPS process 4 of 15).
const hasDistinctReplica = replicaConfigured &&
    dbIdentity(process.env.READ_REPLICA_URL) !== dbIdentity(process.env.DATABASE_URL);

const replicaUrl = hasDistinctReplica ? getSafeDatabaseUrl(process.env.READ_REPLICA_URL || '', isWorker) : '';

const readClient = hasDistinctReplica
    ? (globalForPrisma.readClient ?? new PrismaClient({
        datasources: replicaUrl ? { db: { url: replicaUrl } } : undefined,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      }))
    : primaryClient;

if (hasDistinctReplica) {
    globalForPrisma.readClient = readClient;
}

/**
 * Enhanced Prisma Client with:
 * - Read/Write Splitting
 * - Request Tracing
 * - Slow Query Logging
 */
export const prisma = primaryClient.$extends({
    query: {
        async $allOperations({ operation, model, args, query }) {
            const start = Date.now();

            // ROUTING LOGIC: 
            // Move heavy Read operations to Replica if available.
            const readOperations = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'];
            const isReadOperation = readOperations.includes(operation);

            const store = requestContext.getStore();
            const forcePrimary = store?.forcePrimary === true;
            // Auto-route reads to primary for REPLICA_LAG_WINDOW_MS after any write
            const withinLagWindow = store?.forcePrimaryUntil != null && Date.now() < store.forcePrimaryUntil;

            let result;
            // Only route to replica if it's a read operation, replica bypass is not forced,
            // we're outside the post-write lag window, and a distinct replica is configured.
            if (isReadOperation && !forcePrimary && !withinLagWindow && hasDistinctReplica) {
                // Execute on Read Replica
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result = await (readClient as any)[model as string][operation](args);
            } else {
                // Execute on Primary (Write/Master)
                result = await query(args);
            }

            // After any write, extend the primary-routing window so subsequent
            // reads within REPLICA_LAG_WINDOW_MS hit the primary (not a stale replica).
            if (!isReadOperation && store) {
                store.forcePrimaryUntil = Date.now() + REPLICA_LAG_WINDOW_MS;
            }

            const duration = Date.now() - start;

            // PERFORMANCE LOGGING
            if (duration > 500) {
                const reqId = getRequestId();
                const traceInfo = reqId ? `[ReqID: ${reqId}] ` : '';
                const isReplicaUsed = isReadOperation && hasDistinctReplica;
                const replicaTag = isReplicaUsed ? '[REPLICA] ' : '[PRIMARY] ';

                logger.perf(`${traceInfo}${replicaTag}Prisma Query: ${model}.${operation}`, duration, {
                    operation,
                    model
                });
            }

            return result;
        },
    },
});

export { primaryClient, readClient };
// Turbopack Cache Reload Timestamp: 2026-07-24

