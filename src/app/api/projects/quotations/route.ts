import { NextRequest, NextResponse } from 'next/server';
import { QuotationService } from '@/services/quotation.service';

// GET /api/projects/quotations?requisitionId=xxx - List quotations
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const requisitionId = searchParams.get('requisitionId');

        if (!requisitionId) {
            return NextResponse.json({ error: 'requisitionId is required' }, { status: 400 });
        }

        const quotations = await QuotationService.getQuotations(requisitionId);
        return NextResponse.json(quotations);
    } catch (error: unknown) {
        console.error('Error fetching quotations:', error);
        return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }
}

// POST /api/projects/quotations - Create a new quotation
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requisitionId, vendorId, items } = body;

        if (!requisitionId || !vendorId || !items?.length) {
            return NextResponse.json(
                { error: 'requisitionId, vendorId, and items are required' },
                { status: 400 }
            );
        }

        const quotation = await QuotationService.createQuotation(body);
        return NextResponse.json(quotation, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating quotation:', error);
        const errorCode = (error as { code?: string }).code;
        if (errorCode === 'P2002') {
            return NextResponse.json({ error: 'Quote number already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
    }
}

// PATCH /api/projects/quotations - Update quotation status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, acceptedById } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const quotation = await QuotationService.updateQuotationStatus(id, status, acceptedById);
        return NextResponse.json(quotation);
    } catch (error: unknown) {
        console.error('Error updating quotation:', error);
        return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
    }
}
