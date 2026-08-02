export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';
import { SystemService } from '@/services/core/system.service';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { systemQueue } from '@/lib/queue';

export const GET = apiHandler(async () => {
    const health: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            redis: 'unknown',
            queue: 'unknown'
        },
        monitoring: {
            pool: null
        }
    };

    try {
        // Check DB
        const poolMetrics = await SystemService.checkDatabaseHealth();
        health.services.database = 'healthy';
        if (poolMetrics) {
            health.monitoring.pool = poolMetrics;
        }
    } catch (e) {
        health.status = 'error';
        health.services.database = 'unhealthy';
        logger.error('Health Check: Database connection failed', e);
    }

    try {
        // Check Redis
        await redis.ping();
        health.services.redis = 'healthy';
    } catch (e) {
        health.status = 'error';
        health.services.redis = 'unhealthy';
        logger.error('Health Check: Redis connection failed', e);
    }

    try {
        // Check Queue
        await systemQueue.getActiveCount();
        health.services.queue = 'healthy';
    } catch (e) {
        health.status = 'error';
        health.services.queue = 'unhealthy';
        logger.error('Health Check: Queue check failed', e);
    }

    const status = health.status === 'ok' ? 200 : 503;
    return Response.json(health, { status });
}, { rawResponse: true });
