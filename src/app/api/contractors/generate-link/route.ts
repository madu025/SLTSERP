import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        const result = await ContractorService.generateRegistrationLink({
            ...body,
            origin
        });

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('Error generating link:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
