import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await context.params;
        const contractor = await ContractorService.getContractorByToken(token);
        return NextResponse.json(contractor);
    } catch (error: any) {
        if (error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
    try {
        const data = await request.json();
        const { token } = await context.params;

        await ContractorService.submitPublicRegistration(token, data);

        return NextResponse.json({ success: true, message: 'Registration submitted for review.' });
    } catch (error: any) {
        console.error('Registration error:', error);
        if (error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
