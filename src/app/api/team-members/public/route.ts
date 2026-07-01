
import { NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ isValid: false, message: 'Missing token' }, { status: 400 });
    }

    try {
        const member = await TeamMemberService.verifyUploadToken(token);
        return NextResponse.json({ isValid: true, member });
    } catch (error: any) {
        console.error("Error verifying team token:", error);
        const message = error.message;
        if (message === 'INVALID_TOKEN') {
            return NextResponse.json({ isValid: false, message: 'Invalid token' }, { status: 404 });
        }
        if (message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ isValid: false, message: 'Link expired' }, { status: 410 });
        }
        return NextResponse.json({ isValid: false, message: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { token, data } = await request.json();

        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        await TeamMemberService.updateProfileByToken(token, data);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error updating team member public:", error);
        const message = error.message;
        if (message === 'INVALID_TOKEN') {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }
        if (message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ error: "Link expired" }, { status: 410 });
        }
        return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
    }
}
