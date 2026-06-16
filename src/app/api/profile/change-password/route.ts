import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, currentPassword, newPassword } = body;

        if (!userId || !currentPassword || !newPassword) {
            return NextResponse.json(
                { message: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate new password strength
        if (newPassword.length < 6) {
            return NextResponse.json(
                { message: 'New password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Fetch user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true
            }
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return NextResponse.json(
                { message: 'Current password is incorrect' },
                { status: 401 }
            );
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json(
            { message: 'Error changing password' },
            { status: 500 }
        );
    }
}
