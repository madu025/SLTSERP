import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Available columns for each table
const TABLE_COLUMNS = {
    pending_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'statusDate', label: 'Status Date' },
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
        { key: 'serviceType', label: 'Service Type' },
        { key: 'techContact', label: 'Tech Contact' },
        { key: 'address', label: 'Address' },
        { key: 'package', label: 'Package' },
        { key: 'sales', label: 'Sales' },
        { key: 'actions', label: 'Actions', required: true }
    ],
    completed_sod: [
        { key: 'soNum', label: 'SO Number', required: true },
        { key: 'statusDate', label: 'Status Date' },
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
        { key: 'statusDate', label: 'Status Date' },
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

// GET - Get column settings for all tables or specific table
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tableName = searchParams.get('tableName');

        if (tableName) {
            // Get settings for specific table
            const settings = await (prisma as any).tableColumnSettings.findUnique({
                where: { tableName }
            });

            const availableColumns = TABLE_COLUMNS[tableName as keyof typeof TABLE_COLUMNS] || [];
            const visibleColumns = settings ? JSON.parse(settings.columns) : availableColumns.map(c => c.key);

            return NextResponse.json({
                tableName,
                availableColumns,
                visibleColumns
            });
        }

        // Get all settings
        const allSettings = await (prisma as any).tableColumnSettings.findMany();
        const result: any = {};

        for (const tableKey of Object.keys(TABLE_COLUMNS)) {
            const setting = allSettings.find((s: any) => s.tableName === tableKey);
            const availableColumns = TABLE_COLUMNS[tableKey as keyof typeof TABLE_COLUMNS];
            result[tableKey] = {
                tableName: tableKey,
                availableColumns,
                visibleColumns: setting ? JSON.parse(setting.columns) : availableColumns.map(c => c.key)
            };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching table settings:', error);
        return NextResponse.json({ message: 'Error fetching table settings' }, { status: 500 });
    }
}

// POST - Update column settings for a table
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tableName, visibleColumns } = body;

        if (!tableName || !visibleColumns || !Array.isArray(visibleColumns)) {
            return NextResponse.json({ message: 'Table name and visible columns are required' }, { status: 400 });
        }

        // Make sure required columns are always included
        const tableColumns = TABLE_COLUMNS[tableName as keyof typeof TABLE_COLUMNS];
        if (!tableColumns) {
            return NextResponse.json({ message: 'Invalid table name' }, { status: 400 });
        }

        const requiredColumns = tableColumns.filter(c => c.required).map(c => c.key);
        const finalColumns = [...new Set([...requiredColumns, ...visibleColumns])];

        // Upsert the settings
        const settings = await (prisma as any).tableColumnSettings.upsert({
            where: { tableName },
            update: { columns: JSON.stringify(finalColumns) },
            create: { tableName, columns: JSON.stringify(finalColumns) }
        });

        return NextResponse.json({
            tableName,
            visibleColumns: JSON.parse(settings.columns)
        });
    } catch (error) {
        console.error('Error updating table settings:', error);
        return NextResponse.json({ message: 'Error updating table settings' }, { status: 500 });
    }
}
