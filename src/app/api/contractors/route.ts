import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all contractors
export async function GET() {
    try {
        const contractors = await prisma.contractor.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(contractors);
    } catch (error) {
        console.error('Error fetching contractors:', error);
        return NextResponse.json({ message: 'Error fetching contractors' }, { status: 500 });
    }
}

// POST - Create a new contractor
export async function POST(request: Request) {
    try {
        // RBAC Check
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { message: 'Forbidden: Insufficient Permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, contactNumber, nic, email, address } = body;

        if (!name) {
            return NextResponse.json({ message: 'Contractor name is required' }, { status: 400 });
        }

        const contractor = await prisma.contractor.create({
            data: {
                name,
                contactNumber,
                nic,
                email,
                address
            }
        });

        return NextResponse.json(contractor);
    } catch (error) {
        console.error('Error creating contractor:', error);
        return NextResponse.json({ message: 'Error creating contractor' }, { status: 500 });
    }
}
