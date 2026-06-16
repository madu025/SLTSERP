import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const logs = await prisma.auditLog.findMany({
            take: 200,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        username: true
                    }
                }
            }
        });

        return NextResponse.json(logs);
    } catch (error) {
        console.error('Audit Log Fetch Error:', error);
        return NextResponse.json({ message: 'Error fetching audit logs' }, { status: 500 });
    }
}
