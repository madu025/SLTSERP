import { apiHandler } from '@/lib/api-handler';
import { CostAllocationService } from '@/services/finance/cost-allocation.service';
import { z } from 'zod';

const createMemoSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    allocationTarget: z.string().optional(),
    approvedAt: z.union([z.string(), z.date()]).optional().nullable(),
    receivedAt: z.union([z.string(), z.date()]).optional().nullable(),
    documentUrl: z.string().optional(),
    items: z.array(z.object({
        itemName: z.string().min(1, "Item name is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        unitCost: z.number().min(0, "Unit cost must be positive")
    })).min(1, "At least one item is required")
});

export const GET = apiHandler(async () => {
    const memos = await CostAllocationService.getAllocationMemos();
    return Response.json({ success: true, data: memos });
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER']
});

export const POST = apiHandler(async (_req, _params, body) => {
    const payload = createMemoSchema.parse(body);
    const memo = await CostAllocationService.createAllocationMemo(payload);
    return Response.json({ success: true, data: memo });
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER'],
    audit: { action: 'CREATE_COST_ALLOCATION_MEMO', entity: 'Finance' }
});
