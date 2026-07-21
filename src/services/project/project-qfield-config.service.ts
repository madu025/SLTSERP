import { prisma } from '@/lib/prisma';

export interface QFieldConfigInput {
    layerId?: string;
    fieldName?: string;
    options?: string[];
}

export class ProjectQFieldConfigService {
    static async getConfigs(projectId: string) {
        return await prisma.qFieldFieldConfig.findMany({
            where: { projectId },
            orderBy: [
                { layerId: 'asc' },
                { fieldName: 'asc' }
            ]
        });
    }

    static async updateConfigs(projectId: string, configs: QFieldConfigInput[]) {
        const filteredConfigs = configs
            .map(c => ({
                layerId: c.layerId?.trim(),
                fieldName: c.fieldName?.trim(),
                options: Array.isArray(c.options)
                    ? c.options.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0)
                    : []
            }))
            .filter((c): c is { layerId: string; fieldName: string; options: string[] } => 
                !!c.layerId && !!c.fieldName && c.options.length > 0
            );

        const result = await prisma.$transaction(async (tx) => {
            await tx.qFieldFieldConfig.deleteMany({
                where: { projectId }
            });

            if (filteredConfigs.length > 0) {
                return tx.qFieldFieldConfig.createMany({
                    data: filteredConfigs.map(c => ({
                        projectId,
                        layerId: c.layerId,
                        fieldName: c.fieldName,
                        options: c.options
                    }))
                });
            }
            return { count: 0 };
        });

        const updatedConfigs = await prisma.qFieldFieldConfig.findMany({
            where: { projectId },
            orderBy: [
                { layerId: 'asc' },
                { fieldName: 'asc' }
            ]
        });

        return {
            message: 'Field configurations updated successfully',
            count: result.count,
            configs: updatedConfigs
        };
    }
}
