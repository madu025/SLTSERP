import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Username and password are required' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { username: username.toLowerCase() },
        });

        if (!user) {
            return NextResponse.json(
                { message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json(
                { message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Generate JWT Token
        const token = await signJWT({
            id: user.id,
            username: user.username,
            role: user.role,
        });

        // Set HttpOnly Cookie
        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400, // 24 hours
            path: '/',
        });

        return NextResponse.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
            },
        });
    } catch (error: any) {
        console.error('CRITICAL LOGIN ERROR:', error);
        return NextResponse.json(
            { message: 'Internal server error', debug: error.message },
            { status: 500 }
        );
    }
}
