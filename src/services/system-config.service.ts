import { prisma } from '@/lib/prisma';
import { SystemService } from '@/services/system.service';

export class SystemConfigService {
    /**
     * Fetch all system configs as a key-value map.
     */
    static async getConfigs(): Promise<Record<string, string>> {
        // Use raw query to fetch configs (model not in client)
        const configs: { key: string, value: string }[] = await prisma.$queryRaw`SELECT * FROM "SystemConfig"`;

        // Convert array to object
        return configs.reduce((acc: Record<string, string>, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    }

    /**
     * Upsert a system config.
     */
    static async updateConfig(key: string, value: string, description: string | undefined, userId: string) {
        // Upsert using raw SQL standard for Postgres
        // Note: Manual handling of updatedAt since Prisma middleware won't run
        const result: { key: string, value: string, description: string | null }[] = await prisma.$queryRaw`
            INSERT INTO "SystemConfig" ("key", "value", "description", "updatedAt")
            VALUES (${key}, ${value}, ${description || null}, NOW())
            ON CONFLICT ("key") 
            DO UPDATE SET "value" = ${value}, "description" = COALESCE(${description || null}, "SystemConfig"."description"), "updatedAt" = NOW()
            RETURNING *
        `;

        await SystemService.logEvent({
            userId,
            action: 'SYSTEM_CONFIG_UPDATE',
            entity: 'SystemConfig',
            entityId: key,
            newValue: { key, value, description }
        });

        return result[0];
    }
}
