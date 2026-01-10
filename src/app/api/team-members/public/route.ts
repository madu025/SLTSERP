
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ isValid: false, message: 'Missing token' }, { status: 400 });
    }

    try {
        const member = await prisma.teamMember.findUnique({
            where: { uploadToken: token },
            select: {
                id: true,
                name: true,
                uploadTokenExpiry: true,
                shoeSize: true,
                tshirtSize: true,
                photoUrl: true,
                nicUrl: true,
                policeReportUrl: true,
                gramaCertUrl: true,
                passportPhotoUrl: true
            }
        });

        if (!member) {
            return NextResponse.json({ isValid: false, message: 'Invalid token' }, { status: 404 });
        }

        if (member.uploadTokenExpiry && new Date() > member.uploadTokenExpiry) {
            return NextResponse.json({ isValid: false, message: 'Link expired' }, { status: 410 });
        }

        return NextResponse.json({ isValid: true, member });
    } catch (error) {
        console.error("Error verifying team token:", error);
        return NextResponse.json({ isValid: false, message: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { token, data } = await request.json();

        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const member = await prisma.teamMember.findUnique({
            where: { uploadToken: token }
        });

        if (!member) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        if (member.uploadTokenExpiry && new Date() > member.uploadTokenExpiry) {
            return NextResponse.json({ error: "Link expired" }, { status: 410 });
        }

        // Update Member
        await prisma.teamMember.update({
            where: { id: member.id },
            data: {
                shoeSize: data.shoeSize,
                tshirtSize: data.tshirtSize,
                photoUrl: data.photoUrl,
                passportPhotoUrl: data.passportPhotoUrl,
                nicUrl: data.nicUrl,
                policeReportUrl: data.policeReportUrl,
                gramaCertUrl: data.gramaCertUrl,
                // We keep the token valid for re-uploads until expiry.
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating team member public:", error);
        return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
    }
}
