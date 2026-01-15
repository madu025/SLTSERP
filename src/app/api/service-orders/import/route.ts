import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-utils';

interface ImportRow {
    serialNo: number;
    rtom: string; // RTOM code from Excel (e.g., "AD", "HK")
    voiceNumber: string;
    orderType: string;
    receivedDate: Date | null;
    completedDate: Date | null;
    package: string;
    dropWireDistance: number;
    contractorName: string;
    directTeamName: string;
    materials: Record<string, number>; // Column name -> quantity
}

interface ImportResult {
    success: boolean;
    soNum: string;
    voiceNumber: string;
    rtom: string;
    soNumSource: 'PAT' | 'LEGACY';
    error?: string;
}

// Parse Excel date (handles both date objects and string dates)
export function parseExcelDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) return value;

    if (typeof value === 'number') {
        // Excel serial date number
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'string') {
        // Try parsing DD-MMM-YYYY or other formats
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }

    return null;
}

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
        const { rows, skipMaterials = false } = body as {
            rows: ImportRow[];
            skipMaterials?: boolean;
        };

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No data to import' }, { status: 400 });
        }

        // Get ALL OPMCs to map RTOM codes
        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, storeId: true }
        });

        // Build RTOM -> OPMC map (handles both "AD" and "R-AD" formats)
        const opmcMap: Record<string, { id: string; rtom: string; storeId: string | null }> = {};
        for (const opmc of allOpmcs) {
            // Map by full RTOM (e.g., "R-AD")
            opmcMap[opmc.rtom.toUpperCase()] = opmc;
            // Also map by short code (e.g., "AD")
            const shortCode = opmc.rtom.replace('R-', '');
            opmcMap[shortCode.toUpperCase()] = opmc;
        }

        // Get all inventory items with their import aliases
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inventoryItemsRaw = await (prisma.inventoryItem as any).findMany({
            select: { id: true, code: true, name: true, importAliases: true }
        });
        const inventoryItems = inventoryItemsRaw as Array<{ id: string; code: string; name: string; importAliases: string[] }>;

        // Build alias -> itemId map
        const aliasMap: Record<string, string> = {};
        for (const item of inventoryItems) {
            if (item.importAliases && item.importAliases.length > 0) {
                for (const alias of item.importAliases) {
                    aliasMap[alias.toUpperCase().trim()] = item.id;
                }
            }
        }

        // Get ALL contractors for mapping (will filter by OPMC later)
        const allContractors = await prisma.contractor.findMany({
            select: { id: true, name: true, opmcId: true }
        });

        // Build contractor name -> id map (grouped by OPMC)
        const contractorMap: Record<string, Record<string, string>> = {};
        for (const c of allContractors) {
            if (c.opmcId) {
                if (!contractorMap[c.opmcId]) {
                    contractorMap[c.opmcId] = {};
                }
                contractorMap[c.opmcId][c.name.toUpperCase().trim()] = c.id;
            }
        }

        // 1. Fetch SLTPATStatus records to recover real SO_NUMs by Voice Number
        const patRecords = await prisma.sLTPATStatus.findMany({
            select: { soNum: true, voiceNumber: true }
        });

        const voiceToSoMap: Record<string, string> = {};
        for (const p of patRecords) {
            if (p.voiceNumber) {
                voiceToSoMap[p.voiceNumber.trim()] = p.soNum;
            }
        }

        const results: ImportResult[] = [];
        let successCount = 0;
        let errorCount = 0;
        let skippedNoOpmc = 0;

        // Process in batches of 100
        const BATCH_SIZE = 100;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    // Find OPMC by RTOM code from the row
                    const rtomKey = (row.rtom || '').toUpperCase().trim();
                    const opmc = opmcMap[rtomKey];

                    if (!opmc) {
                        results.push({
                            success: false,
                            soNum: '',
                            voiceNumber: row.voiceNumber || '',
                            rtom: row.rtom || '',
                            soNumSource: 'LEGACY',
                            error: `OPMC not found for RTOM: ${row.rtom}`
                        });
                        skippedNoOpmc++;
                        errorCount++;
                        continue;
                    }

                    // 2. Try to find real SO_NUM from PAT data first
                    const realVoiceNumber = (row.voiceNumber || '').trim();
                    let soNum = voiceToSoMap[realVoiceNumber];
                    let isAutoGenerated = false;

                    if (!soNum) {
                        // Fallback: Generate legacy SO number if not found in PAT
                        const legacyDate = row.completedDate ? new Date(row.completedDate) : new Date();
                        const yearMonth = `${legacyDate.getFullYear()}${String(legacyDate.getMonth() + 1).padStart(2, '0')}`;
                        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                        soNum = `${opmc.rtom.replace('R-', '')}-LEG-${yearMonth}-${randomSuffix}`;
                        isAutoGenerated = true;
                    }

                    // Find contractor for this OPMC
                    const opmcContractors = contractorMap[opmc.id] || {};
                    const contractorId = row.contractorName
                        ? opmcContractors[row.contractorName.toUpperCase().trim()] || null
                        : null;

                    // Prepare material usage data
                    const materialUsageData: Array<{
                        item: { connect: { id: string } };
                        quantity: number;
                        unit: string;
                        usageType: string;
                    }> = [];

                    if (!skipMaterials && row.materials) {
                        for (const [columnName, quantity] of Object.entries(row.materials)) {
                            if (quantity && quantity > 0) {
                                const itemId = aliasMap[columnName.toUpperCase().trim()];
                                if (itemId) {
                                    materialUsageData.push({
                                        item: { connect: { id: itemId } },
                                        quantity: quantity,
                                        unit: 'Nos',
                                        usageType: 'USED'
                                    });
                                }
                            }
                        }
                    }

                    // Create service order using raw data object
                    const createData: Record<string, unknown> = {
                        soNum,
                        opmcId: opmc.id,
                        rtom: opmc.rtom,
                        voiceNumber: row.voiceNumber || null,
                        orderType: row.orderType || 'CREATE',
                        statusDate: row.receivedDate ? new Date(row.receivedDate) : null,
                        completedDate: row.completedDate ? new Date(row.completedDate) : null,
                        package: row.package || null,
                        dropWireDistance: row.dropWireDistance || 0,
                        status: 'COMPLETED',
                        sltsStatus: 'COMPLETED',
                        isLegacyImport: true,
                        directTeam: row.directTeamName || null,
                    };

                    if (contractorId) {
                        createData.contractorId = contractorId;
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (prisma.serviceOrder as any).create({
                        data: {
                            ...createData,
                            ...(materialUsageData.length > 0 && {
                                materialUsage: { create: materialUsageData }
                            })
                        }
                    });

                    results.push({
                        success: true,
                        soNum,
                        voiceNumber: row.voiceNumber || '',
                        rtom: opmc.rtom,
                        soNumSource: isAutoGenerated ? 'LEGACY' : 'PAT'
                    });
                    successCount++;
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                    results.push({
                        success: false,
                        soNum: '',
                        voiceNumber: row.voiceNumber || '',
                        rtom: row.rtom || '',
                        soNumSource: 'LEGACY',
                        error: errorMsg
                    });
                    errorCount++;
                }
            }
        }

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

// Get only assigned materials (MaterialStandards) for manual mapping
// Get items for mapping (focused on OSP FTTH items)
export async function GET() {
    try {
        // Fetch items that are marked for OSP FTTH context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = await (prisma.inventoryItem as any).findMany({
            where: {
                isOspFtth: true
            },
            select: {
                id: true,
                code: true,
                name: true,
                commonName: true,
                importAliases: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ materials: items });
    } catch (error) {
        return handleApiError(error);
    }
}
