import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/preferences
 * Fetch notification preferences for the current user
 */
export async function GET() {
    try {
        const headersList = await headers();
        const userId = headersList.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const preferences = await (prisma as any).notificationPreference.findMany({
            where: { userId }
        });

        return NextResponse.json(preferences);
    } catch (error) {
        console.error('[API_GET_PREFERENCES]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/notifications/preferences
 * Toggle a notification preference
 */
export async function POST(req: Request) {
    try {
        const headersList = await headers();
        const userId = headersList.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type, enabled } = await req.json();

        if (!type || typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const preference = await (prisma as any).notificationPreference.upsert({
            where: {
                userId_type: {
                    userId,
                    type
                }
            },
            update: { enabled },
            create: {
                userId,
                type,
                enabled
            }
        });

        return NextResponse.json(preference);
    } catch (error) {
        console.error('[API_POST_PREFERENCES]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
