import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const preferenceUpdateSchema = z.object({
    type: z.string(),
    inApp: z.boolean().optional(),
    browser: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    sms: z.boolean().optional()
});

interface NotificationPreferenceRecord {
    id: string;
    userId: string;
    type: string;
    enabled: boolean;
    inApp: boolean;
    browser: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface NotificationPreferenceClient {
    notificationPreference: {
        findMany: (args: { where: { userId: string } }) => Promise<NotificationPreferenceRecord[]>;
        upsert: (args: {
            where: { userId_type: { userId: string; type: string } };
            update: Record<string, boolean>;
            create: Record<string, unknown>;
        }) => Promise<NotificationPreferenceRecord>;
    };
}

export const GET = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const preferences = await (prisma as unknown as NotificationPreferenceClient).notificationPreference.findMany({
        where: { userId }
    });

    return NextResponse.json({
        success: true,
        data: preferences
    });
});

export const POST = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const body = await req.json();
    const payload = preferenceUpdateSchema.parse(body);

    const preference = await (prisma as unknown as NotificationPreferenceClient).notificationPreference.upsert({
        where: {
            userId_type: {
                userId,
                type: payload.type
            }
        },
        update: {
            ...(payload.inApp !== undefined && { inApp: payload.inApp }),
            ...(payload.browser !== undefined && { browser: payload.browser }),
            ...(payload.push !== undefined && { push: payload.push }),
            ...(payload.email !== undefined && { email: payload.email }),
            ...(payload.sms !== undefined && { sms: payload.sms })
        },
        create: {
            userId,
            type: payload.type,
            inApp: payload.inApp ?? true,
            browser: payload.browser ?? true,
            push: payload.push ?? false,
            email: payload.email ?? true,
            sms: payload.sms ?? false
        }
    });

    return NextResponse.json({
        success: true,
        data: preference
    });
});
