import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                staff: true,
                accessibleOpmcs: {
                    select: {
                        id: true,
                        name: true,
                        rtom: true
                    }
                },
                assignedStore: {
                    select: {
                        id: true,
                        name: true,
                        location: true
                    }
                },
                supervisor: {
                    select: {
                        name: true,
                        role: true,
                        username: true
                    }
                },
                subordinates: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                sectionAssignments: {
                    include: {
                        section: {
                            select: {
                                name: true,
                                icon: true
                            }
                        },
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                auditLogs: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Profile Fetch Error:', error);
        return NextResponse.json({ message: 'Error fetching profile' }, { status: 500 });
    }
}
