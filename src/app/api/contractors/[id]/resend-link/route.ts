import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const origin = new URL(request.url).origin;

        if (!id) {
            return NextResponse.json({ error: 'Contractor ID is required' }, { status: 400 });
        }

        const result = await ContractorService.resendRegistrationLink(id, origin);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('Error resending link:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
