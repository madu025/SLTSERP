import { apiHandler } from '@/lib/api-handler';
import { DynamicReportService, DynamicReportPayload } from '@/services/inventory/dynamic-report.service';
import { z } from 'zod';

const dynamicReportSchema = z.object({
    entity: z.enum(['serviceOrder', 'materialUsage', 'contractorStock', 'journalEntry', 'wastage']),
    columns: z.array(z.string()).min(1, 'At least one column is required'),
    filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'startsWith']),
        value: z.string()
    })),
    aggregation: z.object({
        groupBy: z.string(),
        targetField: z.string(),
        type: z.enum(['SUM', 'AVG', 'COUNT'])
    }).optional()
});

export const POST = apiHandler(async (_req, _params, body) => {
    const payload = dynamicReportSchema.parse(body) as DynamicReportPayload;
    const report = await DynamicReportService.generateReport(payload);
    
    return Response.json({ success: true, data: report });
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER'],
    audit: { action: 'GENERATE_DYNAMIC_REPORT', entity: 'Reports' }
});
