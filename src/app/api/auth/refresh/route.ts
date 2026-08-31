export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
                sectionAssignments: { include: { role: true } },
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

        // Derive permissions
        let permissions: string[] = [];
        if (user.permissions) {
            try { permissions = JSON.parse(user.permissions); } catch { /* ignore */ }
        } else if (user.sectionAssignments.length > 0) {
            permissions = [...new Set(user.sectionAssignments.flatMap(a => {
                try { return JSON.parse(a.role?.permissions || '[]'); } catch { return []; }
            }))];
        }

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
            },
        });

        // Set new access token cookie
        const isProd = process.env.NODE_ENV === 'production';
        const accessCookie = `token=${newAccessToken}; Max-Age=900; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}; HttpOnly`;
        response.headers.set('Set-Cookie', accessCookie);

        return response;
    } catch (error) {
        console.error('[AUTH-REFRESH] DB lookup failed:', (error as Error).message);
        return NextResponse.json(
            { success: false, error: { code: 'REFRESH_FAILED', message: 'Token refresh failed' } },
            { status: 500 }
        );
    }
}
