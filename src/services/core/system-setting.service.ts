import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class SystemSettingService {
    static async getSetting(key: string) {
        const setting = await prisma.systemSetting.findUnique({ where: { key } });
        return setting?.value ? (setting.value as Record<string, unknown>) : null;
    }

    static async upsertSetting(key: string, value: Prisma.InputJsonValue) {
        return prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
    }
}
