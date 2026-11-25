export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { SESSION_POLICY, IDLE_SECONDS_HEADER, absoluteLimitReached, parseIdleSeconds, refreshLifetimeSeconds } from '@/config/session-policy';
import { prisma } from '@/lib/prisma';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { safeNextPath } from '@/lib/safe-next-path';

/**
 * GET /api/auth/refresh?next=/path
 * Used by the middleware for page loads whose access token has expired: refreshes the session with the user's real
 * permissions, then sends the browser back to the page. A failed refresh clears the cookies and goes to the login page.
 */
export async function GET(request: NextRequest) {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    const result = await POST(request);
    // Relative Location: behind the reverse proxy request.url carries the internal host (0.0.0.0:3000), not the public one.
    const target = result.status === 200 ? next : `/login?callbackUrl=${encodeURIComponent(next)}`;
    const redirect = new NextResponse(null, { status: 307, headers: { Location: target } });
    // Carry the cookies the refresh set (new access token on success, cleared cookies on failure)
    for (const cookie of result.headers.getSetCookie()) redirect.headers.append('Set-Cookie', cookie);
    if (result.status !== 200) {
        const isProd = process.env.NODE_ENV === 'production';
        redirect.headers.append('Set-Cookie', `token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
        redirect.headers.append('Set-Cookie', `refresh_token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
    }
    return redirect;
}

/**
 * POST /api/auth/refresh
 * Client-side token refresh: validates refresh_token cookie, issues new access token.
 * This is a fallback for when middleware auto-refresh doesn't reach the client
 * (e.g., fetch calls that get 401 before middleware can refresh).
 */
export async function POST(request: NextRequest) {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
        return NextResponse.json(
            { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available' } },
            { status: 401 }
        );
    }

    const refreshPayload = await verifyRefreshToken(refreshToken);
    if (!refreshPayload) {
        // Refresh token expired or invalid — clear both cookies
        const response = NextResponse.json(
            { success: false, error: { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token expired or invalid' } },
            { status: 401 }
        );
        const isProd = process.env.NODE_ENV === 'production';
        response.headers.append('Set-Cookie', `token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
        response.headers.append('Set-Cookie', `refresh_token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
        return response;
    }

    // When the person signed in (kept as the refresh token is replaced). Tokens issued before this policy carry no such claim: their issue time is the sign-in.
    const nowSec = Math.floor(Date.now() / 1000);
    const authTime = typeof refreshPayload.authTime === 'number' ? refreshPayload.authTime : typeof refreshPayload.iat === 'number' ? refreshPayload.iat : nowSec;
    // How long the person has really been inactive, as the browser measured it (background polling is not activity)
    const idleSeconds = parseIdleSeconds(request.headers.get(IDLE_SECONDS_HEADER));
    const endedBy = absoluteLimitReached(authTime, nowSec) ? 'SESSION_LIMIT_REACHED' : idleSeconds >= SESSION_POLICY.idleTimeoutSeconds ? 'SESSION_IDLE' : null;
    if (endedBy) {
        // Signed in for the absolute limit (12 hours), or inactive for the idle time: a new sign-in is required
        const response = NextResponse.json(
            { success: false, error: { code: endedBy, message: 'Please sign in again' } },
            { status: 401 }
        );
        const secure = process.env.NODE_ENV === 'production';
        response.headers.append('Set-Cookie', `token=; Max-Age=0; Path=/; SameSite=Lax${secure ? '; Secure' : ''}; HttpOnly`);
        response.headers.append('Set-Cookie', `refresh_token=; Max-Age=0; Path=/; SameSite=Lax${secure ? '; Secure' : ''}; HttpOnly`);
        return response;
    }

    const userId = (refreshPayload.userId || refreshPayload.sub) as string;
    const refreshRole = refreshPayload.role as string;
    const refreshTokenVersion = refreshPayload.tokenVersion as number | undefined;
    const refreshContractorId = refreshPayload.contractorId as string | undefined;

    if (!userId) {
        return NextResponse.json(
            { success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token missing user data' } },
            { status: 401 }
        );
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, username: true, role: true, contractorId: true,
                tokenVersion: true, permissions: true, status: true,
                mustChangePassword: true,
                systemRole: { include: { rolePermissions: { include: { permissionDefinition: true } } } },
                sectionAssignments: { include: { role: { include: { rolePermissions: { include: { permissionDefinition: true } } } } } },
            },
        });

        if (!user || (user.status || 'active').toLowerCase() !== 'active') {
            return NextResponse.json(
                { success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Account is no longer active' } },
                { status: 401 }
            );
        }

        // Check tokenVersion match (password change invalidates refresh tokens)
        if (refreshTokenVersion !== undefined && refreshTokenVersion !== user.tokenVersion) {
            const response = NextResponse.json(
                { success: false, error: { code: 'TOKEN_VERSION_MISMATCH', message: 'Session invalidated' } },
                { status: 401 }
            );
            const isProd = process.env.NODE_ENV === 'production';
            response.headers.append('Set-Cookie', `token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
            response.headers.append('Set-Cookie', `refresh_token=; Max-Age=0; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
            return response;
        }

        // Use the same DB permission resolver as login and API requests.
        const permissions = deriveEffectivePermissions(user);

        // Sign new access token
        const newAccessToken = await signAccessToken({
            id: user.id,
            username: user.username,
            role: user.role,
            contractorId: user.contractorId || undefined,
            tokenVersion: user.tokenVersion,
            permissions: permissions.length > 0 ? permissions : undefined,
            mustChangePassword: user.mustChangePassword || undefined,
        });

        const response = NextResponse.json({
            success: true,
            token: newAccessToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                contractorId: user.contractorId,
                permissions,
                designations: [...new Set([user.systemRole?.code, ...user.sectionAssignments.map((a) => a.role?.code)].filter((c): c is string => !!c))],
            },
        });

        // New access token cookie, and a NEW refresh token (rotation): the idle window starts again, but never past the absolute limit
        const isProd = process.env.NODE_ENV === 'production';
        const newRefreshToken = await signRefreshToken({ userId: user.id, role: user.role as string, tokenVersion: user.tokenVersion, contractorId: user.contractorId || undefined }, { authTime, nowSec, idleSeconds });
        const refreshMaxAge = Math.max(1, refreshLifetimeSeconds(authTime, nowSec, idleSeconds));
        response.headers.append('Set-Cookie', `token=${newAccessToken}; Max-Age=${SESSION_POLICY.accessTokenSeconds}; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);
        response.headers.append('Set-Cookie', `refresh_token=${newRefreshToken}; Max-Age=${refreshMaxAge}; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`);

        return response;
    } catch (error) {
        console.error('[AUTH-REFRESH] DB lookup failed:', (error as Error).message);
        return NextResponse.json(
            { success: false, error: { code: 'REFRESH_FAILED', message: 'Token refresh failed' } },
            { status: 500 }
        );
    }
}
