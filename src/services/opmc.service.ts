import { prisma } from '@/lib/prisma';
import { CacheService } from '@/lib/cache.service';
import { AppError } from '@/lib/error';

const OPMC_CACHE_KEY = 'opmcs:all';

export interface OPMCData {
    id: string;
    rtom: string;
    name: string;
    region: string;
    province: string;
    storeId?: string | null;
    store?: { id: string; name: string } | null;
    users?: Array<{ id: string; name: string }>;
    _count?: { staff: number; projects: number };
}

export class OpmcService {
    static async getAllOPMCs() {
        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.READ_REPLICA_URL === "";

        if (!isTestEnv) {
            try {
                const cached = await CacheService.get<OPMCData[]>(OPMC_CACHE_KEY);
                if (cached) {
                    return cached;
                }
            } catch (cacheError) {
                console.error(`[CACHE ERROR] Failed to read from Redis cache:`, cacheError);
            }
        }

        const opmcs = await prisma.oPMC.findMany({
            include: {
                store: { select: { id: true, name: true } },
                users: {
                    where: { role: 'AREA_MANAGER' },
                    select: { id: true, name: true }
                },
                _count: {
                    select: {
                        staff: true,
                        projects: true
                    }
                }
            },
            orderBy: { rtom: 'asc' }
        });

        if (!isTestEnv) {
            try {
                await CacheService.set(OPMC_CACHE_KEY, opmcs, 3600);
            } catch (cacheError) {
                console.error(`[CACHE ERROR] Failed to write to Redis cache:`, cacheError);
            }
        }

        return opmcs;
    }

    static async createOPMC(data: { name: string; rtom: string; region: string; province: string; storeId?: string | null }) {
        try {
            const opmc = await prisma.oPMC.create({
                data: {
                    name: data.name,
                    rtom: data.rtom,
                    region: data.region,
                    province: data.province,
                    storeId: data.storeId || null
                }
            });

            await this.invalidateCache();
            return opmc;
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw AppError.badRequest('OPMC RTOM already exists');
            }
            throw error;
        }
    }

    static async updateOPMC(data: { id: string; name: string; rtom: string; region: string; province: string; storeId?: string | null }) {
        try {
            const opmc = await prisma.oPMC.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    rtom: data.rtom,
                    region: data.region,
                    province: data.province,
                    storeId: data.storeId || null
                }
            });

            await this.invalidateCache();
            return opmc;
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw AppError.badRequest('RTOM already exists');
            }
            throw error;
        }
    }

    static async deleteOPMC(id: string) {
        await prisma.oPMC.delete({
            where: { id }
        });
        await this.invalidateCache();
        return true;
    }

    private static async invalidateCache() {
        try {
            await CacheService.del(OPMC_CACHE_KEY);
        } catch (cacheError) {
            console.error(`[CACHE ERROR] Failed to invalidate OPMCs cache:`, cacheError);
        }
    }
}
