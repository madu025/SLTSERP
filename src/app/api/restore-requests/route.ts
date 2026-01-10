import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';

// GET - List restore requests (filtered by role and OPMC)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'PENDING';
        const opmcId = searchParams.get('opmcId');
        const userId = searchParams.get('userId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: any = { status };

        // If opmcId provided, filter by OPMC
        if (opmcId) {
            where.serviceOrder = {
                opmcId
            };
        }

        const skip = (page - 1) * limit;

        const [total, requests] = await Promise.all([
            prisma.restoreRequest.count({ where }),
            prisma.restoreRequest.findMany({
                where,
                include: {
                    serviceOrder: {
                        select: {
                            id: true,
                            soNum: true,
                            customerName: true,
                            voiceNumber: true,
                            address: true,
                            rtom: true,
                            opmc: { select: { id: true, name: true } }
                        }
                    },
                    requestedBy: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            email: true
                        }
                    },
                    approvedBy: {
                        select: {
                            id: true,
                            name: true,
                            username: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return NextResponse.json({
            requests,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching restore requests:', error);
        return NextResponse.json({ message: 'Error fetching restore requests' }, { status: 500 });
    }
}

// POST - Create restore request
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serviceOrderId, reason, userId, requestedByUsername } = body;

        let finalUserId = userId;

        if (!finalUserId && requestedByUsername) {
            const user = await prisma.user.findUnique({ where: { username: requestedByUsername } });
            if (user) finalUserId = user.id;
        }

        if (!serviceOrderId || !reason || !finalUserId) {
            return NextResponse.json({ message: 'Service Order ID, reason, and user ID (or username) required' }, { status: 400 });
        }

        // Check if service order exists and is COMPLETED or RETURN
        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { id: serviceOrderId }
        });

        if (!serviceOrder) {
            return NextResponse.json({ message: 'Service order not found' }, { status: 404 });
        }

        if (serviceOrder.sltsStatus !== 'COMPLETED' && serviceOrder.sltsStatus !== 'RETURN') {
            return NextResponse.json({ message: 'Can only request restore for COMPLETED or RETURN service orders' }, { status: 400 });
        }

        // Check for existing pending request
        const existingRequest = await prisma.restoreRequest.findFirst({
            where: {
                serviceOrderId,
                status: 'PENDING'
            }
        });

        if (existingRequest) {
            return NextResponse.json({ message: 'A pending restore request already exists for this service order' }, { status: 400 });
        }

        // Create restore request
        const restoreRequest = await prisma.restoreRequest.create({
            data: {
                serviceOrderId,
                requestedById: finalUserId,
                reason
            },
            include: {
                serviceOrder: true,
                requestedBy: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                }
            }
        });

        // Notify Admins and Supervisors in the OPMC
        try {
            const message = `User "${restoreRequest.requestedBy.name || restoreRequest.requestedBy.username}" has requested to restore Service Order ${restoreRequest.serviceOrder.soNum}. Reason: ${restoreRequest.reason}`;

            await NotificationService.notifyByRole({
                roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER', 'OFFICE_ADMIN'],
                title: "New Restore Request",
                message,
                type: 'SYSTEM',
                priority: 'MEDIUM',
                link: `/restore-requests`,
                opmcId: restoreRequest.serviceOrder.opmcId
            });
        } catch (nErr) {
            console.error("Failed to send restore request notifications:", nErr);
        }

        return NextResponse.json(restoreRequest);
    } catch (error) {
        console.error('Error creating restore request:', error);
        return NextResponse.json({ message: 'Error creating restore request' }, { status: 500 });
    }
}

// PATCH - Approve or reject restore request
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action, approvedById, comment } = body;

        if (!id || !action || !approvedById) {
            return NextResponse.json({ message: 'Request ID, action, and approver ID required' }, { status: 400 });
        }

        // Verify Identity: Ensure approvedById matches the authenticated user
        const authenticatedUserId = request.headers.get('x-user-id');
        if (authenticatedUserId && authenticatedUserId !== approvedById) {
            return NextResponse.json({ message: 'Identity verification failed' }, { status: 403 });
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        }

        // Get the restore request with requester info
        const restoreRequest = await prisma.restoreRequest.findUnique({
            where: { id },
            include: {
                serviceOrder: true,
                requestedBy: {
                    include: { supervisor: true }
                }
            }
        });

        if (!restoreRequest) {
            return NextResponse.json({ message: 'Restore request not found' }, { status: 404 });
        }

        if (restoreRequest.status !== 'PENDING') {
            return NextResponse.json({ message: 'This request has already been processed' }, { status: 400 });
        }

        // PERMISSION CHECK
        // Fetch the approver to check their role and OPMC access
        const approver = await prisma.user.findUnique({
            where: { id: approvedById },
            include: { accessibleOpmcs: true }
        });

        if (!approver) {
            return NextResponse.json({ message: 'Approver user not found' }, { status: 404 });
        }

        const isSuperAdmin = approver.role === 'SUPER_ADMIN';
        const isAdmin = approver.role === 'ADMIN';
        // Check if approver is the supervisor of the requester
        const isSupervisor = restoreRequest.requestedBy.supervisorId === approver.id;

        // Requester cannot approve their own request (unless SUPER_ADMIN)
        if (restoreRequest.requestedById === approvedById && !isSuperAdmin) {
            return NextResponse.json({ message: 'You cannot approve your own restore request.' }, { status: 403 });
        }

        // OPMC Access Check (Required for non-SuperAdmins)
        const hasOpmcAccess = approver.accessibleOpmcs.some(o => o.id === restoreRequest.serviceOrder.opmcId);

        if (!isSuperAdmin) {
            if (!hasOpmcAccess) {
                return NextResponse.json({ message: 'Permission denied. You do not have access to this OPMC area.' }, { status: 403 });
            }
            if (!isAdmin && !isSupervisor) {
                return NextResponse.json({ message: 'Permission denied. Only Admins or the requester\'s Supervisor can approve.' }, { status: 403 });
            }
        }

        // Update restore request
        const updatedRequest = await prisma.restoreRequest.update({
            where: { id },
            data: {
                status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                approvedById,
                approvalComment: comment || null
            }
        });

        // If approved, restore service order to INPROGRESS
        if (action === 'APPROVE') {
            await prisma.serviceOrder.update({
                where: { id: restoreRequest.serviceOrderId },
                data: {
                    sltsStatus: 'INPROGRESS',
                    completedDate: null
                }
            });
        }

        // Notify the Requester about the decision
        try {
            const statusLabel = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
            const message = `Your restore request for Service Order ${restoreRequest.serviceOrder.soNum} has been ${statusLabel}.${comment ? ` Note: ${comment}` : ''}`;

            await NotificationService.send({
                userId: restoreRequest.requestedById,
                title: `Restore Request ${statusLabel}`,
                message,
                type: 'SYSTEM',
                priority: action === 'APPROVE' ? 'HIGH' : 'MEDIUM',
                link: `/service-orders`
            });
        } catch (nErr) {
            console.error("Failed to notify requester:", nErr);
        }

        return NextResponse.json(updatedRequest);
    } catch (error) {
        console.error('Error processing restore request:', error);
        return NextResponse.json({ message: 'Error processing restore request' }, { status: 500 });
    }
}
