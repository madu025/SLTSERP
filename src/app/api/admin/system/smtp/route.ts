import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

interface SmtpConfigValue {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
    from?: string;
}

const SmtpSchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.union([z.string().min(1, 'Port is required'), z.number()]).transform(String),
    user: z.string().min(1, 'Username is required'),
    pass: z.string().min(1, 'Password is required'),
    from: z.string().min(1, 'From address is required')
});

export const GET = apiHandler(async () => {
    const setting = await prisma.systemSetting.findUnique({
        where: { key: 'SMTP_CONFIG' }
    });

    if (!setting) {
        return NextResponse.json({
            data: { host: '', port: '587', user: '', pass: '', from: '"SLTS Nexus ERP" <noreply@slt.lk>' }
        });
    }

    // Mask password in GET
    const config = (setting.value ?? {}) as SmtpConfigValue;
    return NextResponse.json({
        data: {
            ...config,
            pass: config.pass ? '********' : ''
        }
    });
}, { roles: ROLE_GROUPS.ADMINS });

export const PUT = apiHandler(async (_req, _params, body) => {
    const validated = SmtpSchema.parse(body);

    let passToSave = validated.pass;

    // If password is masked, preserve the old one
    if (passToSave === '********') {
        const existing = await prisma.systemSetting.findUnique({
            where: { key: 'SMTP_CONFIG' }
        });

        const existingPass = (existing?.value as SmtpConfigValue | null)?.pass;
        if (existingPass) {
            passToSave = existingPass;
        } else {
            throw AppError.badRequest('Real password is required for first-time setup.');
        }
    }

    const valueToSave = {
        ...validated,
        pass: passToSave
    };

    await prisma.systemSetting.upsert({
        where: { key: 'SMTP_CONFIG' },
        update: { value: valueToSave },
        create: { key: 'SMTP_CONFIG', value: valueToSave }
    });

    return NextResponse.json({
        message: 'SMTP settings updated successfully',
        data: {
            ...valueToSave,
            pass: '********'
        }
    });
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'UPDATE_SMTP_CONFIG', entity: 'SystemSetting' }
});
