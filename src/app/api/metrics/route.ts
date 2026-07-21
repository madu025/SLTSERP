import { PrometheusService } from '@/services/admin/prometheus.service';

export const dynamic = 'force-dynamic';

// GET /api/metrics - Public / Scraper Prometheus Metrics Exposition Endpoint
export async function GET(req: Request) {
    // Optional Bearer Token Security check if PROMETHEUS_BEARER_TOKEN is configured in .env
    const secretToken = process.env.PROMETHEUS_BEARER_TOKEN;
    if (secretToken) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
            return new Response('Unauthorized Prometheus Scraper', { status: 401 });
        }
    }

    const metricsText = await PrometheusService.generateMetricsText();

    return new Response(metricsText, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}
