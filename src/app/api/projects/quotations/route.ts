import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/quotations?requisitionId=xxx - List quotations
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const requisitionId = searchParams.get('requisitionId');

        if (!requisitionId) {
            return NextResponse.json({ error: 'requisitionId is required' }, { status: 400 });
        }

        const quotations = await prisma.quotation.findMany({
            where: { requisitionId },
            include: {
                items: true,
                vendor: { select: { id: true, code: true, name: true } }
            },
            orderBy: { quoteDate: 'desc' },
        });

        return NextResponse.json(quotations);
    } catch (error: any) {
        console.error('Error fetching quotations:', error);
        return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }
}

// POST /api/projects/quotations - Create a new quotation
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            requisitionId,
            vendorId,
            vendorName,
            quoteDate,
            validUntil,
            currency,
            deliveryDays,
            warrantyPeriod,
            paymentTerms,
            remarks,
            items,
        } = body;

        if (!requisitionId || !vendorId || !items?.length) {
            return NextResponse.json(
                { error: 'requisitionId, vendorId, and items are required' },
                { status: 400 }
            );
        }

        // Auto-generate quote number
        const lastQuote = await prisma.quotation.findFirst({
            orderBy: { quoteNumber: 'desc' },
            select: { quoteNumber: true },
        });

        let nextQuoteNumber: string;
        if (lastQuote && lastQuote.quoteNumber) {
            const lastNum = parseInt(lastQuote.quoteNumber.replace('QTN-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextQuoteNumber = 'QTN-' + String(nextNum).padStart(5, '0');
        } else {
            nextQuoteNumber = 'QTN-00001';
        }

        // Calculate total
        let totalAmount = 0;
        const itemsData = items.map((item: any) => {
            const totalPrice = (item.unitPrice || 0) * (item.quantity || 0);
            totalAmount += totalPrice;
            return {
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit || 'NOS',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice,
                deliveryDays: item.deliveryDays || null,
                notes: item.notes || null,
            };
        });

        const quotation = await prisma.$transaction(async (tx) => {
            const newQuote = await tx.quotation.create({
                data: {
                    quoteNumber: nextQuoteNumber,
                    requisitionId,
                    vendorId,
                    vendorName: vendorName || '',
                    quoteDate: quoteDate ? new Date(quoteDate) : new Date(),
                    validUntil: validUntil ? new Date(validUntil) : null,
                    totalAmount,
                    currency: currency || 'LKR',
                    deliveryDays: deliveryDays || null,
                    warrantyPeriod: warrantyPeriod || null,
                    paymentTerms: paymentTerms || null,
                    remarks: remarks || null,
                    items: { create: itemsData },
                },
                include: { items: true, vendor: true },
            });
            return newQuote;
        });

        return NextResponse.json(quotation, { status: 201 });
    } catch (error: any) {
        console.error('Error creating quotation:', error);
        if (error.code === 'P2002') {
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

        const updateData: any = { status };
        if (status === 'ACCEPTED' && acceptedById) {
            updateData.acceptedById = acceptedById;
            updateData.acceptedAt = new Date();
        }

        const quotation = await prisma.quotation.update({
            where: { id },
            data: updateData,
            include: { items: true, vendor: true },
        });

        return NextResponse.json(quotation);
    } catch (error: any) {
        console.error('Error updating quotation:', error);
        return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
    }
}
