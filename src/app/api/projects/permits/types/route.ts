import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all permit types with their authority
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');
        const authorityId = searchParams.get('authorityId');

        const where: Record<string, unknown> = {};

        if (isActive !== null) {
            where.isActive = isActive === 'true';
        }
        if (authorityId) {
            where.authorityId = authorityId;
        }

        const permitTypes = await prisma.permitType.findMany({
            where,
            include: {
                authority: {
                    select: {
                        id: true,
                        name: true,
                        shortName: true,
                        contactPerson: true,
                        contactNumber: true,
                        email: true,
                        isActive: true
                    }
                },
                _count: {
                    select: {
                        permits: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(permitTypes);
    } catch (error) {
        console.error('Error fetching permit types:', error);
        return NextResponse.json(
            { error: 'Failed to fetch permit types' },
            { status: 500 }
        );
    }
}
