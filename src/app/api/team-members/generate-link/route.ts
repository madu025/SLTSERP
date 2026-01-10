
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { memberId } = await request.json();

        if (!memberId) {
            return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await prisma.teamMember.update({
            where: { id: memberId },
            data: {
                uploadToken: token,
                uploadTokenExpiry: expiry
            }
        });

        const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/team-upload/${token}`;

        return NextResponse.json({ link });
    } catch (error) {
        console.error("Error generating team member link:", error);
        return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
    }
}
