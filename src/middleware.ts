import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// Define paths that do NOT require authentication
const publicPaths = [
    '/login',
    '/api/login',
    '/public',
    '/contractor-upload',
    '/contractor-registration',
    '/api/contractors/public',
    '/api/contractors/public-register',
    '/api/banks',
    '/api/branches',
    '/api/inventory/stores',
    '/api/upload',
    '/team-upload',
    '/api/team-members/public',
    '/api/health',
    '/api/cron'
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Generate Request ID for tracing
    const requestId = crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);

    // Check if the path is public
    if (
        publicPaths.some((path) => pathname.startsWith(path)) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.')
    ) {
        return NextResponse.next({
            request: { headers: requestHeaders }
        });
    }

    // Check for token
    const token = request.cookies.get('token')?.value;

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

        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If authenticated
    requestHeaders.set('x-user-id', verifiedToken.id as string);
    requestHeaders.set('x-user-role', verifiedToken.role as string);

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

// Apply to all routes except Next.js internals
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
