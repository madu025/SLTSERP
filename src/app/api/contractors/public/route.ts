import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ message: 'Token required' }, { status: 400 });
    }

    try {
        const contractor = await prisma.contractor.findUnique({
            where: { uploadToken: token },
            select: {
                id: true,
                name: true,
                uploadTokenExpiry: true,
                // Access current docs to show if already uploaded (optional, but good UX)
                photoUrl: true,
                nicFrontUrl: true,
                nicBackUrl: true,
                policeReportUrl: true,
                gramaCertUrl: true,
                bankPassbookUrl: true,
                brCertUrl: true,
                bankName: true,
                bankBranch: true,
                bankAccountNumber: true
            }
        });

        if (!contractor) {
            return NextResponse.json({ isValid: false, message: 'Invalid token' }, { status: 404 });
        }

        if (contractor.uploadTokenExpiry && new Date() > contractor.uploadTokenExpiry) {
            return NextResponse.json({ isValid: false, message: 'Link expired' }, { status: 410 });
        }

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

    } catch (error) {
        console.error('Error validating public token:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, documents } = body;

        if (!token) return NextResponse.json({ message: 'Token required' }, { status: 400 });

        const contractor = await prisma.contractor.findUnique({
            where: { uploadToken: token }
        });

        if (!contractor) return NextResponse.json({ message: 'Invalid token' }, { status: 404 });
        if (contractor.uploadTokenExpiry && new Date() > contractor.uploadTokenExpiry) {
            return NextResponse.json({ message: 'Link expired' }, { status: 410 });
        }

        // Securely update ONLY the document fields
        // We do NOT allow updating name, bank details (unless specified), or status here.
        // We set documentStatus to 'PENDING' so admin sees there are new docs to review.
        await prisma.contractor.update({
            where: { id: contractor.id },
            data: {
                photoUrl: documents.photoUrl,
                nicFrontUrl: documents.nicFrontUrl,
                nicBackUrl: documents.nicBackUrl,
                policeReportUrl: documents.policeReportUrl,
                gramaCertUrl: documents.gramaCertUrl,
                bankPassbookUrl: documents.bankPassbookUrl,
                brCertUrl: documents.brCertUrl,

                // Update Bank Details if provided
                bankName: documents.bankName,
                bankBranch: documents.bankBranch,
                bankAccountNumber: documents.bankAccountNumber,

                documentStatus: 'PENDING' // Reset to pending for Admin Review
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error submitting public documents:', error);
        return NextResponse.json({ message: 'Submission failed' }, { status: 500 });
    }
}
