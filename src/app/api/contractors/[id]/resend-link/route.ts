import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const origin = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin);

        if (!id) {
            return NextResponse.json({ error: 'Contractor ID is required' }, { status: 400 });
        }

        const result = await ContractorService.resendRegistrationLink(id, origin);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error resending link:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
