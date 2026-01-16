import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CacheService } from '@/lib/cache.service';

interface OPMCData {
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

const OPMC_CACHE_KEY = 'opmcs:all';

// GET all OPMCs
export async function GET() {
    try {
        const cached = await CacheService.get<OPMCData[]>(OPMC_CACHE_KEY);
        if (cached) return NextResponse.json(cached);

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
            orderBy: { createdAt: 'desc' }
        });

        await CacheService.set(OPMC_CACHE_KEY, opmcs, 3600); // 1 hour cache
        return NextResponse.json(opmcs);
    } catch {
        return NextResponse.json({ message: 'Error fetching OPMCs' }, { status: 500 });
    }
}

// POST new OPMC
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, rtom, region, province, storeId } = body;

        const opmc = await prisma.oPMC.create({
            data: {
                name, rtom, region, province,
                storeId: storeId || null
            }
        });

        await CacheService.del(OPMC_CACHE_KEY);
        return NextResponse.json(opmc);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ message: 'OPMC RTOM already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error creating OPMC' }, { status: 500 });
    }
}

// PUT update OPMC
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, rtom, region, province, storeId } = body;

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        const opmc = await prisma.oPMC.update({
            where: { id },
            data: {
                name, rtom, region, province,
                storeId: storeId || null
            }
        });

        await CacheService.del(OPMC_CACHE_KEY);
        return NextResponse.json(opmc);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ message: 'RTOM already exists' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error updating OPMC' }, { status: 500 });
    }
}

// DELETE OPMC
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        await prisma.oPMC.delete({
            where: { id }
        });

        await CacheService.del(OPMC_CACHE_KEY);
        return NextResponse.json({ message: 'OPMC deleted successfully' });
    } catch {
        return NextResponse.json({ message: 'Error deleting OPMC' }, { status: 500 });
    }
}
