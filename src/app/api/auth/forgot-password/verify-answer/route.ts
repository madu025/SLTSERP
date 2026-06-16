import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify, sign } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: Request) {
    try {
        const { token, answer } = await request.json();

        if (!token || !answer) {
            return NextResponse.json(
                { message: 'Token and answer are required' },
                { status: 400 }
            );
        }

        // Verify token
        let decoded: any;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch (error) {
            return NextResponse.json(
                { message: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        if (decoded.step !== 'verify') {
            return NextResponse.json(
                { message: 'Invalid token' },
                { status: 401 }
            );
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                securityAnswer: true
            }
        });

        if (!user || !user.securityAnswer) {
            return NextResponse.json(
                { message: 'User not found' },
                { status: 404 }
            );
        }

        // Verify answer
        const isCorrect = await bcrypt.compare(answer.toLowerCase().trim(), user.securityAnswer);

        if (!isCorrect) {
            return NextResponse.json(
                { message: 'Incorrect security answer' },
                { status: 401 }
            );
        }

        // Generate reset token
        const resetToken = sign(
            { userId: user.id, step: 'reset' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        return NextResponse.json({
            message: 'Security answer verified',
            token: resetToken
        });

    } catch (error) {
        console.error('Verify answer error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
