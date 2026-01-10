import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Try to execute a simple query
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);

        return NextResponse.json({
            status: 'unhealthy',
            database: 'disconnected',
            error: process.env.NODE_ENV === 'development'
                ? (error instanceof Error ? error.message : String(error))
                : 'Database unavailable',
            timestamp: new Date().toISOString()
        }, { status: 503 });
    }
}
