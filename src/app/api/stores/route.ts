import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/inventory.service';

// GET - Get all stores with their OPMCs (Filtered by User Role)
export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        let whereClause = {};

        if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });

            if (!dbUser) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);

            const baseWhere = {
                OR: [
                    { managerId: userId }, // As Store Manager
                    { opmcs: { some: { id: { in: accessibleOpmcIds } } } } // As Area Manager
                ]
            };

            // Special Logic for Store Staff:
            // If they are assigned to a MAIN store, they can view ALL stores (Global View).
            // If SUB store, only their store.
            const isStoreStaff = userRole === 'STORES_MANAGER' || userRole === 'STORES_ASSISTANT';

            if (isStoreStaff) {
                const hasMainAccess = await prisma.inventoryStore.findFirst({
                    where: {
                        ...baseWhere,
                        type: 'MAIN'
                    },
                    select: { id: true }
                });

                if (hasMainAccess) {
                    whereClause = {}; // Grant Full Access
                } else {
                    whereClause = baseWhere;
                }
            } else {
                // Other roles (e.g. Area Manager) - Restricted to assigned area
                whereClause = baseWhere;
            }
        }

        const stores = await InventoryService.getStores(whereClause);
        return NextResponse.json(stores);
    } catch (error) {
        console.error('Error fetching stores:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new store
export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
        }

        const store = await InventoryService.createStore(body);
        return NextResponse.json(store);
    } catch (error) {
        console.error('Error creating store:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
