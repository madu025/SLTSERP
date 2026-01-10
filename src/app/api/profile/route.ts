import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET current user profile
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ message: 'User ID required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                employeeId: true,
                createdAt: true,
                updatedAt: true,
                accessibleOpmcs: {
                    select: {
                        id: true,
                        rtom: true,
                        region: true,
                        province: true
                    }
                },
                assignedStore: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        location: true
                    }
                },
                sectionAssignments: {
                    select: {
                        section: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        role: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                permissions: true
                            }
                        },
                        isPrimary: true
                    }
                },
                supervisor: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        role: true
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Profile fetch error:', error);
        return NextResponse.json({ message: 'Error fetching profile' }, { status: 500 });
    }
}

// PATCH update profile (basic info only, not roles/permissions)
export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ message: 'User ID required' }, { status: 400 });
        }

        const body = await request.json();
        const { name, email } = body;

        // Only allow updating basic info
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name: name || undefined,
                email: email || undefined
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true
            }
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Profile update error:', error);
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ message: 'Email already in use' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Error updating profile' }, { status: 500 });
    }
}
