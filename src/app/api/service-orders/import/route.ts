import { NextResponse } from 'next/server';
import { ServiceOrderService } from '@/services/sod.service';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        // Auth check using middleware headers
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only ADMIN and SUPER_ADMIN can import
        if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole || '')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { rows, skipMaterials = false } = body;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No data to import' }, { status: 400 });
        }

        const { successCount, errorCount, skippedNoOpmc, results } = await ServiceOrderService.bulkImportLegacyServiceOrders(
            rows,
            skipMaterials
        );

        return NextResponse.json({
            success: true,
            message: `Import completed: ${successCount} succeeded, ${errorCount} failed${skippedNoOpmc > 0 ? ` (${skippedNoOpmc} skipped - OPMC not found)` : ''}`,
            summary: {
                total: rows.length,
                success: successCount,
                failed: errorCount,
                skippedNoOpmc
            },
            results
        });

    } catch (error) {
        return handleApiError(error);
    }
}

// Get items for mapping (focused on OSP FTTH items)
export async function GET() {
    try {
        const items = await ServiceOrderService.getOspFtthItems();
        return NextResponse.json({ materials: items });
    } catch (error) {
        return handleApiError(error);
    }
}
