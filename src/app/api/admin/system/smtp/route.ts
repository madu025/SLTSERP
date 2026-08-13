import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { SmtpConfigService } from '@/services/admin/smtp-config.service';
import { z } from 'zod';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

const SmtpSchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.union([z.string().min(1, 'Port is required'), z.number()]).transform(String),
    user: z.string().min(1, 'Username is required'),
    pass: z.string().min(1, 'Password is required'),
    from: z.string().min(1, 'From address is required')
});

export const GET = apiHandler(async () => {
    const config = await SmtpConfigService.getConfig();
    return NextResponse.json({ data: config });
}, { roles: ROLE_GROUPS.ADMINS });

export const PUT = apiHandler(async (_req, _params, body) => {
    const validated = SmtpSchema.parse(body);
    const result = await SmtpConfigService.updateConfig(validated);

    return NextResponse.json({
        message: 'SMTP settings updated successfully',
        data: result
    });
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'UPDATE_SMTP_CONFIG', entity: 'SystemSetting' }
});
