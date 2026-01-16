/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function GET() {
    const health: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            redis: 'unknown'
        },
        monitoring: {
            pool: null
        }
    };

    try {
        // Check DB
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'healthy';

        // Collect Pool Metrics (Prisma Metrics)
        try {
            const metrics = await (prisma as any).$metrics.json();
            const counters = metrics.counters || [];
            health.monitoring.pool = {
                active: counters.find((c: any) => c.name === 'prisma_client_queries_active')?.value || 0,
                idle: counters.find((c: any) => c.name === 'prisma_client_queries_idle')?.value || 0,
                wait: counters.find((c: any) => c.name === 'prisma_client_queries_wait_count')?.value || 0
            };
        } catch (mErr) {
            console.warn('Could not collect prisma metrics:', mErr);
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

    const status = health.status === 'ok' ? 200 : 503;
    return NextResponse.json(health, { status });
}
