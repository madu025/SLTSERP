import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;
        
        if (!id) {
            return NextResponse.json({ error: 'Contractor ID is required' }, { status: 400 });
        }

        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        const result = await ContractorService.generateRenewalLink(id, origin);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('Error generating renewal link:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
