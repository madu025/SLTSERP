import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { hasRouteAccess } from '@/config/route-permissions';

// Paths that do NOT require authentication.
// EXACT match only — prefix matching leaked sub-routes (e.g. anonymous writes
// on /api/contracts/slt). Truly public endpoints must be listed explicitly.
const publicPaths = [
    '/login',
    '/contractor/login',
    '/api/login',
    '/api/contractor-portal/auth',
    '/api/contractor-portal/auth/login',
    '/api/metrics',
    '/public',
    '/contractor-upload',
    '/contractor-registration',
    '/api/contractors/public',
    '/api/contractors/public-register',
    '/api/branches',
    '/api/upload',
    '/team-upload',
    '/api/team-members/public',
    '/api/health',
    '/api/cron',
    '/api/service-orders/extension-push',
    '/api/service-orders/bridge-sync',
    '/api/service-orders/bridge-data',
    '/api/opmcs',
    '/presentation',
    '/api/invoices/import-bom/csv',
    '/api/invoices/slt-registry',
    '/api/helpdesk/assets/search-by-serial',
    '/api/public/site-offices',
    '/api/public/staff',
    '/api/auth/agent-login',
    '/api/assets/sync',
    '/api/assets/register',
    '/api/helpdesk/agent/telemetry',
    '/api/agent/version',
    '/public/invoices',
    '/api/public/invoices',
    '/api/approvals/webhook',
];

// Public prefixes kept INTENTIONALLY narrow (GET-only, bounded depth).
// These back public contractor registration forms which need supporting
// lookups (banks -> branches) without a session. Every write method under
// these prefixes requires full authentication.
// NOTE: /api/inventory/stores was removed from this list (QA audit) — the
// store list now requires authentication.
const publicPrefixes: Array<{ prefix: string; maxDepth: number }> = [
    { prefix: '/api/banks', maxDepth: 2 },
    // SLT-Bridge extension reads SO data anonymously by SO number
    // (/api/service-orders/bridge-data/<soNum>). Intentionally public,
    // GET-only, depth-1 — the exact-match publicPaths entry above covers the
    // base path itself. Non-GET methods under this prefix require auth.
    { prefix: '/api/service-orders/bridge-data', maxDepth: 1 },
    // Cron endpoints use CRON_SECRET auth (not JWT) - allow all methods
    { prefix: '/api/cron', maxDepth: 1 },
    // Public invoice view (contractor shareable link with UUID)
    { prefix: '/api/public/invoices', maxDepth: 1 },
    { prefix: '/public/invoices', maxDepth: 1 },
];

function isPublicPath(pathname: string, method: string): boolean {
    if (publicPaths.includes(pathname)) {
        // Public parent routes expose reads only — their write methods must
        // pass authentication and apiHandler role guards
        if (pathname === '/api/banks' && method !== 'GET') return false;
        // SLT-Bridge base path exposes reads only — anonymous writes on
        // /api/service-orders/bridge-data must pass authentication
        if (pathname === '/api/service-orders/bridge-data' && method !== 'GET') return false;
        // /api/upload is POST-only; its own handler enforces fail-closed auth
        // (session JWT or scoped public upload token) for anonymous callers
        if (pathname === '/api/upload' && method !== 'POST') return false;
        return true;
    }
    for (const { prefix, maxDepth } of publicPrefixes) {
        if (pathname.startsWith(prefix + '/')) {
            if (method !== 'GET') return false;
            const extraSegments = pathname.slice(prefix.length + 1).split('/').filter(Boolean).length;
            return extraSegments <= maxDepth;
        }
    }
    return false;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Generate Request ID for tracing
    const requestId = crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);

    // Sanitize incoming headers to prevent header spoofing across all trust boundaries
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-user-role');
    requestHeaders.delete('x-contractor-id');
    requestHeaders.delete('x-token-version');
    requestHeaders.delete('x-pathname');

    // Propagate the request path so downstream server components can enforce
    // path-scoped policies (e.g. forced password-change lockdown).
    requestHeaders.set('x-pathname', pathname);

    // Check if the path is public
    const isPublicAuditSubmit = pathname === '/api/helpdesk/assets/audits' && request.method === 'POST';

    // Static asset bypass: only when the LAST segment contains a dot AND the
    // path is not an API route (previously `pathname.includes('.')` let any
    // dotted API path such as /api/x.y skip authentication entirely)
    const lastSegment = pathname.split('/').pop() ?? '';
    const isStaticAsset = lastSegment.includes('.') && !pathname.startsWith('/api');

    if (
        isPublicAuditSubmit ||
        isPublicPath(pathname, request.method) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        isStaticAsset
    ) {
        return NextResponse.next({
            request: { headers: requestHeaders }
        });
    }

    // Check for token
    let token = request.cookies.get('token')?.value;

    // Support extracting token from Authorization header (for scripts and external integrations)
    if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else if (authHeader.startsWith('Token ')) {
                token = authHeader.substring(6);
            }
        }
    }

    // Verify token
    const verifiedToken = token ? await verifyJWT(token) : null;

    // If not authenticated
    if (!verifiedToken) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json(
                { message: 'Authentication required' },
                { status: 401, headers: { 'x-request-id': requestId } }
            );
        }

        const targetRedirect = pathname.startsWith('/contractor') ? '/contractor/login' : '/login';
        const loginUrl = new URL(targetRedirect, request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If authenticated
    const uid = (verifiedToken.userId || verifiedToken.id || verifiedToken.sub) as string;
    if (uid) {
        requestHeaders.set('x-user-id', uid);
    }
    const userRole = verifiedToken.role as string;
    requestHeaders.set('x-user-role', userRole);
    if (verifiedToken.contractorId) {
        requestHeaders.set('x-contractor-id', verifiedToken.contractorId as string);
    }
    // Propagate the token version so downstream handlers can verify session freshness
    if (verifiedToken.tokenVersion !== undefined) {
        requestHeaders.set('x-token-version', String(verifiedToken.tokenVersion));
    }

    // Route-level RBAC enforcement: block direct URL access to pages the role shouldn't reach
    // (sidebar-menu.ts only hides nav items client-side; this blocks actual page loads)
    // Also checks admin-configured DB permissions (via JWT) so dynamic permissions
    // work end-to-end without hardcoding.
    if (!pathname.startsWith('/api') && !pathname.startsWith('/contractor/') && !pathname.startsWith('/login')) {
        const userPermissions = verifiedToken.permissions as string[] | undefined;
        if (!hasRouteAccess(pathname, userRole, userPermissions)) {
            const forbiddenUrl = new URL('/dashboard', request.url);
            return NextResponse.redirect(forbiddenUrl);
        }
    }

    // Note: Forced password-change lockdown is now handled client-side via
    // ForcePasswordChangeModal (global modal on every page). API-level lockdown
    // in api-handler.ts still blocks all non-exempt endpoints.

    // Prevent browser caching of protected pages (stops back-button from showing stale auth pages)
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // Add cache-busting headers for all authenticated page requests (not API/static)
    if (!pathname.startsWith('/api') && !pathname.startsWith('/_next') && !pathname.startsWith('/static')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Surrogate-Control', 'no-store');
    }

    return response;
}

// Apply to all routes except Next.js internals
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
