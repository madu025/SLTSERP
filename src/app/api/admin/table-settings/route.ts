import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';
import { z } from 'zod';

// Available columns for each table
const TABLE_COLUMNS = {
    pending_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'statusDate', label: 'Received Date' },
        { key: 'lea', label: 'LEA' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'iptv', label: 'IPTV' },
        { key: 'woroTaskName', label: 'WORO Task Name' },
        { key: 'dp', label: 'DP' },
        { key: 'status', label: 'Status' },
        { key: 'contractorAssign', label: 'Assign Contractor' },
        { key: 'sltsStatus', label: 'SLTS Status' },
        { key: 'scheduledDate', label: 'Appointment' },
        { key: 'orderType', label: 'Order Type' },
        { key: 'createdAt', label: 'Imported Date' },
        { key: 'serviceType', label: 'Service Type' },
        { key: 'techContact', label: 'Tech Contact' },
        { key: 'address', label: 'Address' },
        { key: 'package', label: 'Package' },
        { key: 'sales', label: 'Sales' },
        { key: 'actions', label: 'Actions', required: true }
    ],
    completed_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'statusDate', label: 'Received Date' },
        { key: 'completedDate', label: 'Completed Date' },
        { key: 'lea', label: 'LEA' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'iptv', label: 'IPTV' },
        { key: 'dp', label: 'DP' },
        { key: 'status', label: 'Status' },
        { key: 'contractor', label: 'Contractor' },
        { key: 'patStatus', label: 'PAT Status' }
    ],
    return_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'statusDate', label: 'Received Date' },
        { key: 'completedDate', label: 'Return Date' },
        { key: 'lea', label: 'LEA' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'voiceNumber', label: 'Voice Number' },
        { key: 'dp', label: 'DP' },
        { key: 'status', label: 'Status' },
        { key: 'sltsStatus', label: 'SLTS Status' },
        { key: 'actions', label: 'Actions', required: true }
    ],
    restore_request: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'requestedBy', label: 'Requested By' },
        { key: 'requestDate', label: 'Request Date' },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status' },
        { key: 'approvedBy', label: 'Approved By' },
        { key: 'actions', label: 'Actions', required: true }
    ]
};

const updateSettingsSchema = z.object({
    tableName: z.string().min(1, 'Table name is required'),
    visibleColumns: z.array(z.string()).min(1, 'Visible columns cannot be empty')
});

// GET - Get column settings for all tables or specific table
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('tableName');

    const result = await AdminSystemService.getTableSettings(tableName, TABLE_COLUMNS);
    return Response.json(result);
}, {
    // Requires authentication, can restrict to certain roles if desired. We use default auth.
});

// POST - Update column settings for a table
export const POST = apiHandler(async (_req, _params, body) => {
    const data = updateSettingsSchema.parse(body);
    
    const result = await AdminSystemService.updateTableSettings(data.tableName, data.visibleColumns, TABLE_COLUMNS);
    return Response.json(result);
}, {
    // Typically any logged-in user can update their table settings if we separate by userId, 
    // but here it looks like a global setting. We will restrict to ADMIN.
    roles: ['SUPER_ADMIN', 'ADMIN'],
    audit: { action: 'UPDATE_TABLE_SETTINGS', entity: 'System' }
});
