import { prisma } from '@/lib/prisma';

interface UpdateEVMInput {
    pvTotal?: number;
    evTotal?: number;
    acTotal?: number;
}

export class ProjectEVMService {
    static async getEVM(projectId: string) {
        const evm = await prisma.projectEVM.findUnique({
            where: { projectId },
            include: {
                snapshots: {
                    orderBy: { snapshotDate: 'desc' },
                    take: 30
                }
            }
        });

        if (!evm) {
            return {
                projectId,
                pvTotal: 0,
                evTotal: 0,
                acTotal: 0,
                scheduleVariance: 0,
                costVariance: 0,
                spi: 1,
                cpi: 1,
                snapshots: []
            };
        }

        return evm;
    }

    static async updateEVM(projectId: string, data: UpdateEVMInput) {
        const { pvTotal, evTotal, acTotal } = data;

        const pv = pvTotal ?? 0;
        const ev = evTotal ?? 0;
        const ac = acTotal ?? 0;

        const scheduleVariance = ev - pv;
        const costVariance = ev - ac;
        const spi = pv > 0 ? ev / pv : 1;
        const cpi = ac > 0 ? ev / ac : 1;

        const evm = await prisma.projectEVM.upsert({
            where: { projectId },
            update: {
                pvTotal: pv,
                evTotal: ev,
                acTotal: ac,
                scheduleVariance,
                costVariance,
                spi,
                cpi
            },
            create: {
                projectId,
                pvTotal: pv,
                evTotal: ev,
                acTotal: ac,
                scheduleVariance,
                costVariance,
                spi,
                cpi
            }
        });

        return evm;
    }
}
