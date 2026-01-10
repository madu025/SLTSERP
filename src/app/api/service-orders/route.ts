import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sltApiService } from '@/services/slt-api.service';

// GET service orders with pagination and summary metrics
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const opmcId = searchParams.get('opmcId');
        const filter = searchParams.get('filter'); // 'pending', 'completed', 'return', or 'all'
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        if (!opmcId) {
            return NextResponse.json({ message: 'OPMC ID required' }, { status: 400 });
        }

        // Build where clause
        let whereClause: any = { opmcId };

        if (filter === 'pending') {
            whereClause.sltsStatus = { notIn: ['COMPLETED', 'RETURN'] };
        } else if (filter === 'completed') {
            whereClause.sltsStatus = 'COMPLETED';
        } else if (filter === 'return') {
            whereClause.sltsStatus = 'RETURN';
        }

        // Run queries in parallel for efficiency
        const [total, items, statusGroups, contractorCount, appointmentCount] = await Promise.all([
            // 1. Total count
            prisma.serviceOrder.count({ where: whereClause }),

            // 2. Paginated items
            prisma.serviceOrder.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),

            // 3. Status breakdown (group by external 'status')
            prisma.serviceOrder.groupBy({
                by: ['status'],
                where: whereClause,
                _count: true
            }),

            // 4. Contractor assigned count
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    contractorId: { not: null }
                }
            }),

            // 5. Appointment count
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    scheduledDate: { not: null }
                }
            })
        ]);

        const totalPages = Math.ceil(total / limit);

        // Format status breakdown
        const statusBreakdown = statusGroups.reduce((acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            items,
            meta: {
                total,
                page,
                limit,
                totalPages
            },
            summary: {
                totalSod: total,
                contractorAssigned: contractorCount,
                appointments: appointmentCount,
                statusBreakdown
            }
        });

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

// PATCH - Update SLTS Status query or Contractor assignment
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, sltsStatus, completedDate, contractorId, comments } = body;

        if (!id) {
            return NextResponse.json({ message: 'Service Order ID required' }, { status: 400 });
        }

        const updateData: any = {};

        if (sltsStatus) {
            if (!['INPROGRESS', 'COMPLETED', 'RETURN'].includes(sltsStatus)) {
                return NextResponse.json({ message: 'Invalid SLTS Status' }, { status: 400 });
            }
            updateData.sltsStatus = sltsStatus;

            // Require completedDate for COMPLETED or RETURN status
            if ((sltsStatus === 'COMPLETED' || sltsStatus === 'RETURN') && !completedDate) {
                return NextResponse.json({ message: 'Completed date is required for COMPLETED or RETURN status' }, { status: 400 });
            }
        }

        // Add completedDate if provided
        if (completedDate) {
            updateData.completedDate = new Date(completedDate);
        }

        // Handle contractor assignment
        if (contractorId !== undefined) {
            updateData.contractorId = contractorId;
        }

        // Add comments update
        if (comments) {
            updateData.comments = comments;
        }

        // Add completion data fields
        if (body.ontSerialNumber) {
            updateData.ontSerialNumber = body.ontSerialNumber;
        }

        if (body.iptvSerialNumbers) {
            updateData.iptvSerialNumbers = body.iptvSerialNumbers;
        }

        if (body.dpDetails) {
            updateData.dpDetails = body.dpDetails;
        }

        // Handle team assignment
        if (body.teamId) {
            updateData.teamId = body.teamId;
        }

        // Handle Material Usage
        if (body.materialUsage && Array.isArray(body.materialUsage)) {
            updateData.materialUsage = {
                create: body.materialUsage.map((m: any) => ({
                    itemId: m.itemId,
                    quantity: parseFloat(m.quantity),
                    unit: m.unit || 'Nos',
                    usageType: m.usageType || 'USED',
                    // Wastage tracking
                    wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                    exceedsLimit: m.exceedsLimit || false,
                    comment: m.comment
                }))
            };
        }

        // If no fields to update
        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
        }

        const serviceOrder = await prisma.serviceOrder.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(serviceOrder);
    } catch (error) {
        console.error('Error updating service order:', error);
        return NextResponse.json({ message: 'Error updating service order' }, { status: 500 });
    }
}
