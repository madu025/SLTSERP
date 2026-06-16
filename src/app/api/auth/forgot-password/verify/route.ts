import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: Request) {
    try {
        const { username, employeeId } = await request.json();

        if (!username || !employeeId) {
            return NextResponse.json(
                { message: 'Username and Employee ID are required' },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                employeeId: true,
                securityQuestion: true,
                securityAnswer: true
            }
        });

        if (!user) {
            return NextResponse.json(
                { message: 'User not found' },
                { status: 404 }
            );
        }

        // Verify employee ID
        if (user.employeeId !== employeeId) {
            return NextResponse.json(
                { message: 'Employee ID does not match' },
                { status: 401 }
            );
        }

        // Check if security question is set
        if (!user.securityQuestion || !user.securityAnswer) {
            return NextResponse.json(
                { message: 'Security question not set. Please contact administrator.' },
                { status: 400 }
            );
        }

        // Generate temporary token
        const token = sign(
            { userId: user.id, step: 'verify' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        return NextResponse.json({
            securityQuestion: user.securityQuestion,
            token
        });

    } catch (error) {
        console.error('Forgot password verify error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
