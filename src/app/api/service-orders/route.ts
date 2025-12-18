import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sltApiService } from '@/services/slt-api.service';

// GET service orders for user's accessible OPMCs
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const opmcId = searchParams.get('opmcId');

        if (!opmcId) {
            return NextResponse.json({ message: 'OPMC ID required' }, { status: 400 });
        }

        // Fetch service orders for the selected OPMC
        const serviceOrders = await prisma.serviceOrder.findMany({
            where: { opmcId },
            orderBy: { statusDate: 'desc' },
            take: 500 // Limit to prevent huge responses
        });

        return NextResponse.json(serviceOrders);
    } catch (error) {
        console.error('Error fetching service orders:', error);
        return NextResponse.json({ message: 'Error fetching service orders' }, { status: 500 });
    }
}

// POST - Manual service order entry
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { opmcId, ...orderData } = body;

        if (!opmcId || !orderData.soNum || !orderData.status) {
            return NextResponse.json({
                message: 'OPMC ID, SO Number, and Status are required'
            }, { status: 400 });
        }

        // Check if already exists with same soNum + status
        const existing = await prisma.serviceOrder.findUnique({
            where: {
                soNum_status: {
                    soNum: orderData.soNum,
                    status: orderData.status
                }
            }
        });

        if (existing) {
            return NextResponse.json({
                message: 'Service order with this SO Number and Status already exists'
            }, { status: 409 });
        }

        const serviceOrder = await prisma.serviceOrder.create({
            data: {
                ...orderData,
                opmcId,
                statusDate: orderData.statusDate ? new Date(orderData.statusDate) : null
            }
        });

        return NextResponse.json(serviceOrder);
    } catch (error) {
        console.error('Error creating service order:', error);
        return NextResponse.json({ message: 'Error creating service order' }, { status: 500 });
    }
}

// PUT - Update service order
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }

        const serviceOrder = await prisma.serviceOrder.update({
            where: { id },
            data: {
                ...updateData,
                statusDate: updateData.statusDate ? new Date(updateData.statusDate) : undefined
            }
        });

        return NextResponse.json(serviceOrder);
    } catch (error) {
        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order' }, { status: 500 });
    }
}

// PATCH - Update SLTS Status only
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, sltsStatus } = body;

        if (!id || !sltsStatus) {
            return NextResponse.json({ message: 'Service Order ID and SLTS Status required' }, { status: 400 });
        }

        if (!['INPROGRESS', 'COMPLETED', 'RETURN'].includes(sltsStatus)) {
            return NextResponse.json({ message: 'Invalid SLTS Status' }, { status: 400 });
        }

        const serviceOrder = await prisma.serviceOrder.update({
            where: { id },
            data: { sltsStatus }
        });

        return NextResponse.json(serviceOrder);
    } catch (error) {
        console.error('Error updating SLTS status:', error);
        return NextResponse.json({ message: 'Error updating SLTS status' }, { status: 500 });
    }
}
