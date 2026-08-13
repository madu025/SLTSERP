import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface SmtpConfigValue {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
    from?: string;
}

const SMTP_KEY = 'SMTP_CONFIG';

const DEFAULT_SMTP: SmtpConfigValue = {
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '"SLTS Nexus ERP" <noreply@slt.lk>'
};

export class SmtpConfigService {
    static async getConfig(): Promise<SmtpConfigValue> {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: SMTP_KEY }
        });

        if (!setting) {
            return { ...DEFAULT_SMTP };
        }

        const config = (setting.value ?? {}) as SmtpConfigValue;
        // Mask password in read responses
        return { ...config, pass: config.pass ? '********' : '' };
    }

    static async updateConfig(validated: SmtpConfigValue): Promise<SmtpConfigValue> {
        let passToSave = validated.pass ?? '';

        // If password is masked, preserve the existing one
        if (passToSave === '********') {
            const existing = await prisma.systemSetting.findUnique({
                where: { key: SMTP_KEY }
            });
            const existingPass = (existing?.value as SmtpConfigValue | null)?.pass;
            if (existingPass) {
                passToSave = existingPass;
            } else {
                throw AppError.badRequest('Real password is required for first-time setup.');
            }
        }

        const valueToSave = { ...validated, pass: passToSave };

        await prisma.systemSetting.upsert({
            where: { key: SMTP_KEY },
            update: { value: valueToSave },
            create: { key: SMTP_KEY, value: valueToSave }
        });

        return { ...valueToSave, pass: '********' };
    }
}
