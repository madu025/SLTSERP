import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

const SmtpSchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.string().min(1, 'Port is required').or(z.number()),
    user: z.string().min(1, 'Username is required'),
    pass: z.string().min(1, 'Password is required'),
    from: z.string().min(1, 'From address is required')
});

export const GET = apiHandler(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = await (prisma as any).systemSetting.findUnique({
        where: { key: 'SMTP_CONFIG' }
    });

    if (!setting) {
        return NextResponse.json({
            data: { host: '', port: '587', user: '', pass: '', from: '"SLTS Nexus ERP" <noreply@slt.lk>' }
        });
    }

    // Mask password in GET
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = setting.value as any;
    return NextResponse.json({
        data: {
            ...config,
            pass: config.pass ? '********' : ''
        }
    });
});

export const PUT = apiHandler(async (req: Request) => {
    const body = await req.json();
    const validated = SmtpSchema.parse(body);

    let passToSave = validated.pass;

    // If password is masked, preserve the old one
    if (passToSave === '********') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = await (prisma as any).systemSetting.findUnique({
            where: { key: 'SMTP_CONFIG' }
        });
        
        if (existing && existing.value) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            passToSave = (existing.value as any).pass;
        } else {
            throw AppError.badRequest('Real password is required for first-time setup.');
        }
    }

    const valueToSave = {
        ...validated,
        pass: passToSave
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).systemSetting.upsert({
        where: { key: 'SMTP_CONFIG' },
        update: { value: valueToSave },
        create: { key: 'SMTP_CONFIG', value: valueToSave }
    });

    return NextResponse.json({
        message: 'SMTP settings updated successfully',
        data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(updated.value as any),
            pass: '********'
        }
    });
});
