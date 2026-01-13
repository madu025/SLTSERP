import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const searchId = searchParams.get('id');
        const searchName = searchParams.get('name');

        if (searchId) {
            const contractor = await prisma.contractor.findUnique({
                where: { id: searchId }
            });
            return NextResponse.json({
                mode: 'findUnique',
                found: !!contractor,
                data: contractor,
                id_length: searchId.length
            });
        }

        if (searchName) {
            const list = await prisma.contractor.findMany({
                where: { name: { contains: searchName, mode: 'insensitive' } }
            });
            return NextResponse.json({
                mode: 'searchName',
                count: list.length,
                data: list
            });
        }

        const contractors = await prisma.contractor.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                registrationNumber: true
            },
            take: 100
        });

        return NextResponse.json({
            mode: 'listAll',
            total_in_db: contractors.length,
            contractors
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
