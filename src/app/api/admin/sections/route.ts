import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all sections
export async function GET() {
    try {
        const sections = await prisma.section.findMany({
            include: {
                _count: {
                    select: {
                        roles: true,
                        userAssignments: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(sections);
    } catch (error) {
        console.error('Error fetching sections:', error);
        return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
    }
}

// POST - Create new section
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, code, description, icon, color } = body;

        if (!name || !code) {
            return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
        }

        const section = await prisma.section.create({
            data: {
                name,
                code: code.toUpperCase(),
                description,
                icon,
                color
            }
        });

        return NextResponse.json(section, { status: 201 });
    } catch (error: any) {
        console.error('Error creating section:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Section with this code already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
    }
}
