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
        if (isWorker) {
            const currentLimit = parseInt(urlObj.searchParams.get('connection_limit') || '0');
            if (currentLimit < 10) {
                urlObj.searchParams.set('connection_limit', '50'); // Force increase for workers
            }
        } else if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
            if (!urlObj.searchParams.has('connection_limit')) {
                urlObj.searchParams.set('connection_limit', '10'); // Optimize serverless connections per container
            }
            if (!urlObj.searchParams.has('pool_timeout')) {
                urlObj.searchParams.set('pool_timeout', '30'); // Reduce connection churn → fewer pg_timezone_names queries
            }
        } else {
            // Local Development: Force low connection pool to prevent Supabase Dev DB exhaustion (EMAXCONNSESSION)
            urlObj.searchParams.set('connection_limit', '3');
            urlObj.searchParams.set('pool_timeout', '10');
        }
        return urlObj.toString();
    } catch {
        return url;
    }
}

const isWorker = process.env.IS_WORKER === 'true';

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
// In local development, these usually point to the same DB.
const hasDistinctReplica = !!(
    process.env.READ_REPLICA_URL &&
    process.env.READ_REPLICA_URL !== process.env.DATABASE_URL
);

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
            if (isReadOperation && !forcePrimary && !withinLagWindow && process.env.READ_REPLICA_URL && process.env.READ_REPLICA_URL !== process.env.DATABASE_URL) {
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
                const isReplicaUsed = isReadOperation && process.env.READ_REPLICA_URL && process.env.READ_REPLICA_URL !== process.env.DATABASE_URL;
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

