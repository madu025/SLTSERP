import { NextResponse } from 'next/server';
import { ContractorService } from '@/services/contractor.service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ message: 'Token required' }, { status: 400 });
    }

    try {
        const contractor = await ContractorService.verifyUploadToken(token);

        return NextResponse.json({
            isValid: true,
            contractor: {
                name: contractor.name,
                documents: {
                    photoUrl: contractor.photoUrl,
                    nicFrontUrl: contractor.nicFrontUrl,
                    nicBackUrl: contractor.nicBackUrl,
                    policeReportUrl: contractor.policeReportUrl,
                    gramaCertUrl: contractor.gramaCertUrl,
                    bankPassbookUrl: contractor.bankPassbookUrl,
                    brCertUrl: contractor.brCertUrl,
                    bankName: contractor.bankName,
                    bankBranch: contractor.bankBranch,
                    bankAccountNumber: contractor.bankAccountNumber
                }
            }
        });

    } catch (error: any) {
        console.error('Error validating public token:', error);
        if (error.message === 'INVALID_TOKEN') {
            return NextResponse.json({ isValid: false, message: 'Invalid token' }, { status: 404 });
        }
        if (error.message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ isValid: false, message: 'Link expired' }, { status: 410 });
        }
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, documents } = body;

        if (!token) return NextResponse.json({ message: 'Token required' }, { status: 400 });

        await ContractorService.submitPublicDocuments(token, documents);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error submitting public documents:', error);
        if (error.message === 'INVALID_TOKEN') {
            return NextResponse.json({ message: 'Invalid token' }, { status: 404 });
        }
        if (error.message === 'TOKEN_EXPIRED') {
            return NextResponse.json({ message: 'Link expired' }, { status: 410 });
        }
        return NextResponse.json({ message: 'Submission failed' }, { status: 500 });
    }
}
