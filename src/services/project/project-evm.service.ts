import { AppError } from '@/lib/error';
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


    static async getSnapshots(projectId: string, limit: number = 90) {
        const evm = await prisma.projectEVM.findFirst({ where: { projectId } });
        if (!evm) return [];
        return await prisma.eVMSnapshot.findMany({
            where: { evmId: evm.id },
            orderBy: { snapshotDate: 'desc' },
            take: limit
        });
    }

    static async recordSnapshot(projectId: string, data: Record<string, unknown>) {
        const evm = await prisma.projectEVM.findFirst({ where: { projectId } });
        if (!evm) throw AppError.notFound('EVM not found for this project');
        
        return await prisma.eVMSnapshot.create({
            data: {
                evmId: evm.id,
                snapshotDate: data.snapshotDate ? new Date(String(data.snapshotDate)) : new Date(),
                periodLabel: data.periodLabel ? String(data.periodLabel) : new Date().toISOString().slice(0,7),
                pvCumulative: data.pvCumulative ? Number(data.pvCumulative) : 0,
                evCumulative: data.evCumulative ? Number(data.evCumulative) : 0,
                acCumulative: data.acCumulative ? Number(data.acCumulative) : 0,
                costVariance: data.evCumulative && data.acCumulative ? Number(data.evCumulative) - Number(data.acCumulative) : 0,
                scheduleVariance: data.evCumulative && data.pvCumulative ? Number(data.evCumulative) - Number(data.pvCumulative) : 0,
                cpi: data.evCumulative && data.acCumulative && Number(data.acCumulative) > 0 ? Number(data.evCumulative) / Number(data.acCumulative) : 1,
                spi: data.evCumulative && data.pvCumulative && Number(data.pvCumulative) > 0 ? Number(data.evCumulative) / Number(data.pvCumulative) : 1,
            }
        });
    }

}
