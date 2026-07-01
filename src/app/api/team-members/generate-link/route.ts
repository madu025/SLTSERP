
import { NextResponse } from 'next/server';
import { TeamMemberService } from '@/services/team-member.service';

export async function POST(request: Request) {
    try {
        const { memberId } = await request.json();

        if (!memberId) {
            return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
        }

        const link = await TeamMemberService.generateUploadLink(memberId);

        return NextResponse.json({ link });
    } catch (error) {
        console.error("Error generating team member link:", error);
        return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
    }
}
