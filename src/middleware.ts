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
    '/api/team-members/public'
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the path is public
    // We strictly check for public paths to avoid accidental leaks
    if (
        publicPaths.some((path) => pathname.startsWith(path)) ||
        // Allow static assets
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // Crude check for files like logo.png, window.svg
    ) {
        return NextResponse.next();
    }

    // Check for token
    const token = request.cookies.get('token')?.value;

    // Verify token
    const verifiedToken = token ? await verifyJWT(token) : null;

    // If not authenticated
    if (!verifiedToken) {
        // API Routes: Return 401
        if (pathname.startsWith('/api')) {
            return NextResponse.json(
                { message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Page Routes: Redirect to login
        // We strictly redirect to avoid any access
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If authenticated, we can proceed.
    // Optionally, we can pass user info to headers (useful for API routes to know who calls them without re-verifying)
    const requestHeaders = new Headers(request.headers);
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
