import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';
import { z } from 'zod';
import { TABLE_COLUMNS } from '@/config/table-columns';

const updateSettingsSchema = z.object({
    tableName: z.string().min(1, 'Table name is required'),
    visibleColumns: z.array(z.string()).min(1, 'Visible columns cannot be empty')
});

// GET - Get column settings for all tables or specific table
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('tableName');

    const result = await AdminSystemService.getTableSettings(tableName, TABLE_COLUMNS);
    return result;
}, {
    rawResponse: true
});

// POST - Update column settings for a table
export const POST = apiHandler(async (_req, _params, body) => {
    const data = updateSettingsSchema.parse(body);
    
    const result = await AdminSystemService.updateTableSettings(data.tableName, data.visibleColumns, TABLE_COLUMNS);
    return result;
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'UPDATE_TABLE_SETTINGS', entity: 'System' },
    rawResponse: true
});
