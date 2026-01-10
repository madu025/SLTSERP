import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch roles for a section
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const roles = await prisma.systemRole.findMany({
            where: { sectionId: params.id },
            include: {
                _count: {
                    select: { userAssignments: true }
                }
            },
            orderBy: [
                { level: 'desc' },
                { name: 'asc' }
            ]
        });

        return NextResponse.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

// POST - Create new role for section
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { name, code, description, level, permissions } = body;

        if (!name || !code) {
            return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
        }

        const role = await prisma.systemRole.create({
            data: {
                name,
                code: code.toUpperCase(),
                sectionId: params.id,
                description,
                level: level || 1,
                permissions: permissions || '[]'
            }
        });

        return NextResponse.json(role, { status: 201 });
    } catch (error: any) {
        console.error('Error creating role:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Role with this code already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }
}
