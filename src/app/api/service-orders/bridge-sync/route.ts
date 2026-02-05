import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * SLT-ERP PHOENIX BRIDGE SYNC v3.2.0
 * Receives detailed capture from the Chrome Extension
 * Features: Intelligent Deep-Parsing for Mashed Portal Data
 */

function deepParse(masterData: Record<string, string>) {
    const mashed = masterData['SERVICE ORDER DETAILS'] || "";
    if (!mashed || mashed.length < 50) return {};

    const extracted: Record<string, string> = {};
    const keywords = [
        'RTOM', 'SERVICE ORDER', 'CIRCUIT', 'SERVICE', 'RECEIVED DATE',
        'CUSTOMER NAME', 'CONTACT NO', 'ADDRESS', 'STATUS', 'STATUS DATE',
        'ORDER TYPE', 'TASK', 'PACKAGE', 'EQUIPMENT CLASS',
        'EQUIPMENT PURCHASE FROM SLT', 'SALES PERSON', 'DP LOOP',
        'CONTRACTOR', 'TEAM', 'CON_NAME', 'MOBILE_TEAM'
    ];

    keywords.forEach((key) => {
        const start = mashed.indexOf(key);
        if (start === -1) return;

        let end = mashed.length;
        // Find the next keyword to determine the end of current value
        for (let j = 0; j < keywords.length; j++) {
            const nextKey = keywords[j];
            const nextIdx = mashed.indexOf(nextKey, start + key.length);
            if (nextIdx !== -1 && nextIdx < end) {
                end = nextIdx;
            }
        }

        let val = mashed.substring(start + key.length, end).trim();
        // Cleanup specific values
        if (key === 'RTOM') val = val.replace('R-', '');
        if (key === 'CIRCUIT') val = val.split(' ')[0]; // Pick first segment

        extracted[key] = val;
    });

    return extracted;
}

const MATERIAL_MAP: Record<string, string> = {
    'DROP WIRE': 'OSPFTA003',
    'FTTH DROP WIRE': 'OSPFTA003',
    'D-WIRE': 'OSPFTA003',
    'DW': 'OSPFTA003',
    'ONT': 'ONT',
    'ONT ROUTER': 'ONT',
    'IPTV': 'IPTV-CPE',
    'STB': 'IPTV-CPE',
    'SET TOP BOX': 'IPTV-CPE',
    'PATCH CORD': 'OSPFTA004',
    'P-CORD': 'OSPFTA004',
    'OTO': 'OSPFTA005',
    'ROSETTE': 'OSPFTA005'
};

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role',
        },
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const soNum = searchParams.get('soNum');

    if (!soNum) {
        return NextResponse.json({ error: 'soNum is required' }, { status: 400 });
    }

    try {
        const rawData = await prisma.extensionRawData.findFirst({
            where: { soNum },
            orderBy: { updatedAt: 'desc' }
        });

        if (!rawData) {
            return NextResponse.json({ success: false, message: 'No bridge data found' });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scraped = (rawData.scrapedData as any);
        return NextResponse.json({
            success: true,
            materialDetails: scraped?.materialDetails || [],
            forensicAudit: scraped?.forensicAudit || [],
            lastSynced: rawData.updatedAt
        });
    } catch (error) {
        console.error('[BRIDGE-GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch bridge data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        interface BridgeSyncPayload {
            soNum: string;
            allTabs?: Record<string, string>;
            teamDetails?: Record<string, string>;
            materialDetails?: Array<{
                TYPE?: string;
                CODE?: string;
                NAME?: string;
                QTY?: string;
                qty?: string | number;
                SERIAL?: string;
                RAW?: Record<string, string>;
            }>;
            forensicAudit?: Array<Record<string, unknown>>;
            url?: string;
            currentUser?: string;
            activeTab?: string;
        }

        const payload = (await request.json()) as BridgeSyncPayload;
        const { soNum, allTabs, teamDetails, forensicAudit } = payload;

        if (!soNum) {
            return NextResponse.json({ message: 'Service Order Number is required' }, { status: 400 });
        }

        console.log(`[BRIDGE-SYNC] Processing sync for SO: ${soNum}`);

        // 1. Flatten all tabs into a single data object
        const masterData: Record<string, string> = {};
        if (allTabs) {
            Object.values(allTabs).forEach((tabData) => {
                if (tabData && typeof tabData === 'object') {
                    Object.assign(masterData, tabData);
                }
            });
        }

        // 2. Deep Parsing Strategy (Fixing Portal Mashing)
        const deepData = deepParse(masterData);

        // 3. Map Bridge Keys to ServiceOrder Model with mash-recovery
        const mapping: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            rtom: masterData['RTOM'] || deepData['RTOM'],
            lea: masterData['LEA'],
            voiceNumber: masterData['CIRCUIT'] || masterData['VOICE NUMBER'] || deepData['CIRCUIT'] || masterData['PRIMARY'],
            orderType: masterData['ORDER TYPE'] || deepData['ORDER TYPE'],
            serviceType: masterData['SERVICE TYPE'] || masterData['SERVICE'] || deepData['SERVICE'],
            customerName: masterData['CUSTOMER NAME'] || deepData['CUSTOMER NAME'],
            techContact: masterData['CONTACT NO'] || masterData['CONTACT NUMBER'] || deepData['CONTACT NO'],
            address: masterData['ADDRESS'] || deepData['ADDRESS'],
            status: masterData['STATUS'] || deepData['STATUS'],
            package: masterData['PACKAGE'] || deepData['PACKAGE'],
            iptv: masterData['IPTV'],
            dpDetails: masterData['DP LOOP'] || masterData['DP'] || deepData['DP LOOP'] || masterData['DP_DETAILS'] || masterData['CONNECTION POINT (DP)'],
            sales: masterData['SALES PERSON'] || masterData['SALES'] || deepData['SALES PERSON'],
        };

        // 3.1 Deep Serial Discovery (ONT & IPTV)
        let ontVal = masterData['ONT_ROUTER_SERIAL_NUMBER'] || masterData['ONT'] || masterData['SERIAL'];
        const iptvSerials: string[] = [];

        Object.entries(masterData).forEach(([k, v]) => {
            const key = k.toLowerCase();
            const val = String(v).trim();
            if (!val || val.length < 5) return;

            if (key.includes('ont_router_serial') || key === 'ont serial' || (key === 'serial' && !ontVal)) {
                ontVal = val;
            }
            if (key.includes('iptv_cpe_serial') || key.includes('stb serial') || key.includes('iptv serial')) {
                if (!iptvSerials.includes(val)) iptvSerials.push(val);
            }
        });

        if (ontVal) mapping.ontSerialNumber = ontVal;
        if (iptvSerials.length > 0) mapping.iptvSerialNumbers = iptvSerials.join(', ');

        // 3.2 Deep Pole Serial Extraction (Look for 'Serial Number 1', 'Pole 1 Serial', etc.)
        const poleSerials: string[] = [];
        Object.entries(masterData).forEach(([k, v]) => {
            const key = k.toUpperCase();
            if ((key.includes('SERIAL NUMBER') || key.includes('POLE')) && key !== 'ONT SERIAL' && key !== 'STB SERIAL') {
                const val = String(v).trim();
                if (val && val.length > 5 && !poleSerials.includes(val) && val !== ontVal && !iptvSerials.includes(val)) {
                    poleSerials.push(val);
                }
            }
        });

        // 4. Find the existing Service Order
        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: { materialUsage: true }
        });


        // 5. Contractor Sync (Match by Name if captured)
        const capturedContractorName = masterData['CON_NAME'] || masterData['CONTRACTOR'] || masterData['CONTRACTOR NAME'] || masterData['CONTRACTOR_NAME'];
        if (capturedContractorName && (!mapping.contractorId || mapping.contractorId === "")) {
            const contractor = await prisma.contractor.findFirst({
                where: { name: { contains: capturedContractorName.trim(), mode: 'insensitive' } }
            });
            if (contractor) {
                mapping.contractorId = contractor.id;
            }
        }

        // 6. Return Connection & Auto-Pilot Logic
        const isServiceReturn =
            masterData['SERVICE RETURN'] === 'on' ||
            masterData['IS_RETURN'] === 'on' ||
            masterData['CHKSODRTN_HIDDEN'] === 'on' ||
            masterData['CHKSODRTN'] === 'on';

        if (isServiceReturn) {
            console.log(`[BRIDGE-SYNC] Auto-Pilot: Detected RETURN Service Order: ${soNum}`);
            mapping.sltsStatus = 'RETURN';
            mapping.returnReason = masterData['RTRESONALL_HIDDEN'] || masterData['SOD RETURN'] || masterData['RETURN REASON'] || 'CUSTOMER NOT READY';
            mapping.comments = masterData['RTCMTALL_HIDDEN'] || masterData['RETURN COMMENT'] || 'Customer delays';

            // Set completedDate to current time if not already set, to mark the return action date
            if (!serviceOrder?.completedDate) {
                mapping.completedDate = new Date();
            }
        }

        // 6.1 Always extract Serials & Materials from bridge
        const materialDetails = payload.materialDetails || [];
        const dropWireItem = materialDetails.find((m) => {
            const type = (m.TYPE || m.NAME || "").toUpperCase();
            return type && (type.includes('DROP WIRE') || type.includes('DWIRE') || type.includes('DW'));
        });

        if (dropWireItem && (dropWireItem.QTY || dropWireItem.qty)) {
            const qtyStr = dropWireItem.QTY || String(dropWireItem.qty);
            const qty = parseFloat(qtyStr);
            if (!isNaN(qty)) {
                mapping.dropWireDistance = qty;
            }
        }

        // 7. Resolve OPMC
        let opmcId = serviceOrder?.opmcId;
        const rtomVal = (mapping.rtom as string) || (serviceOrder?.rtom);
        if (!opmcId && rtomVal) {
            const opmc = await prisma.oPMC.findFirst({
                where: { rtom: { contains: rtomVal.substring(0, 4), mode: 'insensitive' } }
            });
            opmcId = opmc?.id;
        }

        if (!opmcId) {
            const firstOpmc = await prisma.oPMC.findFirst();
            opmcId = firstOpmc?.id || '';
        }

        const dataToUpdate: Partial<Prisma.ServiceOrderUncheckedUpdateInput> = {
            ...mapping,
            opmcId,
            updatedAt: new Date(),
        };

        // Process Dates
        const receivedDateStr = masterData['RECEIVED DATE'] || deepData['RECEIVED DATE'];
        if (receivedDateStr) {
            try { dataToUpdate.receivedDate = new Date(receivedDateStr); } catch { /* ignore */ }
        }

        const statusDateStr = masterData['STATUS DATE'] || deepData['STATUS DATE'];
        if (statusDateStr) {
            try { dataToUpdate.statusDate = new Date(statusDateStr); } catch { /* ignore */ }
        }

        // Handle Completed Status Automations
        if (mapping.status === 'COMPLETED' || mapping.status === 'INSTALL_CLOSED' || mapping.status === 'PROV_CLOSED') {
            // Auto-sync sltsStatus if it's not already something else final
            if (!mapping.sltsStatus) {
                dataToUpdate.sltsStatus = 'COMPLETED';
            }

            // Extract Completed Date
            const compDateStr = masterData['COMPLETED DATE'] || masterData['COMPLETED_DATE'] || statusDateStr;
            if (compDateStr) {
                try { dataToUpdate.completedDate = new Date(compDateStr); } catch { /* ignore */ }
            }

            // Auto-Promote to COMPLETED if it's already closed on portal
            if (dataToUpdate.completedDate && (dataToUpdate.sltsStatus as string) !== 'COMPLETED') {
                dataToUpdate.sltsStatus = 'COMPLETED';
            }
        }

        // Match Team
        const teamName = (teamDetails?.['SELECTED TEAM'] || masterData['MOBILE_TEAM_DETAILS'] || masterData['TEAM_DETAILS'] || masterData['ASSIGNED_TEAM']) as string | undefined;

        if (teamName) {
            const teamCode = teamName.split('-')[0].trim();
            const team = await prisma.contractorTeam.findFirst({
                where: {
                    OR: [
                        { name: { contains: teamName.trim(), mode: 'insensitive' } },
                        { sltCode: { equals: teamCode, mode: 'insensitive' } }
                    ]
                }
            });
            if (team) {
                dataToUpdate.teamId = team.id;
                dataToUpdate.contractorId = team.contractorId;
            }
        }

        const oldStatus = serviceOrder?.sltsStatus || null;
        let syncedOrder: { id: string; soNum: string; sltsStatus: string; opmcId: string } | null = null;
        if (serviceOrder) {
            const result = await prisma.serviceOrder.update({
                where: { id: serviceOrder.id },
                data: dataToUpdate
            });
            syncedOrder = result;
        } else {
            const result = await prisma.serviceOrder.create({
                data: {
                    ...(dataToUpdate as Prisma.ServiceOrderUncheckedCreateInput),
                    soNum,
                    status: (dataToUpdate.status as string) || 'PENDING',
                    sltsStatus: 'INPROGRESS'
                }
            });
            syncedOrder = result;
        }

        // 7.1 Status Change Side Effects (Stats & Notifications)
        if (syncedOrder && syncedOrder.sltsStatus !== oldStatus) {
            try {
                const { StatsService } = await import('@/lib/stats.service');
                await StatsService.handleStatusChange(syncedOrder.opmcId, oldStatus, syncedOrder.sltsStatus);

                if (syncedOrder.sltsStatus === 'RETURN') {
                    const { NotificationService } = await import('@/services/notification.service');
                    await NotificationService.notifyByRole({
                        roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
                        title: 'SOD Returned (Bridge Sync)',
                        message: `Service Order ${syncedOrder.soNum} was marked as RETURN via Extension. Reason: ${mapping.returnReason || 'N/A'}.`,
                        type: 'PROJECT',
                        priority: 'HIGH',
                        link: '/service-orders/return',
                        opmcId: syncedOrder.opmcId,
                        metadata: { soNum: syncedOrder.soNum, id: syncedOrder.id }
                    });
                }
            } catch (e) {
                console.error('[BRIDGE-SYNC] Side-effects failed:', e);
            }
        }

        // 7.2 Auto-Pilot sltsStatus reinforcement
        if (dataToUpdate.completedDate && syncedOrder && syncedOrder.sltsStatus !== 'COMPLETED') {
            await prisma.serviceOrder.update({
                where: { id: syncedOrder.id },
                data: { sltsStatus: 'COMPLETED' }
            });
            // Update stats if it was changed here too
            try {
                const { StatsService } = await import('@/lib/stats.service');
                await StatsService.handleStatusChange(syncedOrder.opmcId, syncedOrder.sltsStatus, 'COMPLETED');
            } catch { /* ignore */ }
        }

        // 8. Forensic Audit Save
        const forensictAuditPayload = forensicAudit || [];
        const voiceStatus = masterData['VOICE_TEST_RESULT'] || masterData['VOICE TEST'] || null;

        if (forensictAuditPayload.length > 0) {
            const forensicModel = (prisma as unknown as { sODForensicAudit: { upsert: (args: Record<string, unknown>) => Promise<unknown> } }).sODForensicAudit;
            if (forensicModel) {
                await forensicModel.upsert({
                    where: { soNum },
                    update: {
                        auditData: forensictAuditPayload,
                        voiceTestStatus: voiceStatus,
                        updatedAt: new Date()
                    },
                    create: {
                        soNum,
                        auditData: forensictAuditPayload,
                        voiceTestStatus: voiceStatus
                    }
                });
            }
        }

        // 9. Material Usage Synchronization (The "Portal Truth" sync)
        if (materialDetails.length > 0 && syncedOrder) {
            console.log(`[BRIDGE-SYNC] Synchronizing ${materialDetails.length} materials for SO: ${soNum}`);

            // For now, we clear existing PORTAL_SYNC materials and re-insert to match portal truth
            // This avoids duplicates while keeping historical manual entries (if any)
            await prisma.sODMaterialUsage.deleteMany({
                where: { serviceOrderId: syncedOrder.id, usageType: 'PORTAL_SYNC' }
            });

            for (const mat of materialDetails) {
                const code = mat.CODE || mat.TYPE;
                const name = mat.NAME;
                const qty = parseFloat(mat.QTY || "0");

                if (qty > 0 && (code || name)) {
                    // Try to find matching ERP Item
                    let item = await prisma.inventoryItem.findFirst({
                        where: {
                            OR: [
                                { code: { equals: code, mode: 'insensitive' } },
                                { name: { equals: name, mode: 'insensitive' } },
                                { importAliases: { has: code || "" } },
                                { importAliases: { has: name || "" } },
                                { name: { contains: name || code || "", mode: 'insensitive' } }
                            ]
                        }
                    });

                    // Fallback: Smart Mapping if no direct match found
                    if (!item) {
                        const searchKey = (name || code || "").toUpperCase();
                        let mappedCode = null;

                        // Check for exact phrases in the map
                        for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                            if (searchKey.includes(key)) {
                                mappedCode = val;
                                break;
                            }
                        }

                        if (mappedCode) {
                            item = await prisma.inventoryItem.findFirst({
                                where: { code: mappedCode }
                            });
                        }
                    }

                    // Extra Serial Discovery for this specific material row
                    const matSerial = mat.SERIAL || (mat.RAW ? (mat.RAW['SERIAL'] || mat.RAW['SERIAL NUMBER'] || mat.RAW['SERIAL NO'] || mat.RAW['ONT_ROUTER_SERIAL_NUMBER_'] || mat.RAW['IPTV_CPE_SERIAL_NUMBER_']) : null);

                    if (item) {
                        await prisma.sODMaterialUsage.create({
                            data: {
                                serviceOrderId: syncedOrder.id,
                                itemId: item.id,
                                quantity: qty,
                                unit: item.unit || "Nos",
                                usageType: 'PORTAL_SYNC',
                                serialNumber: matSerial || null,
                                unitPrice: item.unitPrice || 0,
                                costPrice: item.costPrice || 0,
                                comment: `Auto-synced from Portal [Original: ${name || code}]`
                            }
                        });
                    }
                }
            }
        }

        // 10. Audit Log for Admin (Bridge Monitor)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const monitorModel = (prisma as any).extensionRawData;
            if (monitorModel) {
                const existingRaw = await monitorModel.findFirst({ where: { soNum } });
                if (existingRaw) {
                    await monitorModel.update({
                        where: { id: existingRaw.id },
                        data: {
                            sltUser: payload.currentUser || null,
                            activeTab: payload.activeTab || 'SYNC_PUSH',
                            url: payload.url || null,
                            scrapedData: payload,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await monitorModel.create({
                        data: {
                            soNum,
                            sltUser: payload.currentUser || null,
                            activeTab: payload.activeTab || 'SYNC_PUSH',
                            url: payload.url || null,
                            scrapedData: payload
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('[BRIDGE-SYNC] Monitor Log Failed:', e);
            // Don't fail the whole sync if monitor logging fails
        }

        // 11. Final Response (ExtensionRawData saving removed as requested to avoid duplication)
        return NextResponse.json({
            success: true,
            id: syncedOrder?.id,
            soNum: syncedOrder?.soNum,
            message: 'Bridge sync successful. Core tables updated directly.'
        }, {
            headers: { 'Access-Control-Allow-Origin': '*' }
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[BRIDGE-SYNC] Fatal Error:', error);

        return NextResponse.json({
            success: false,
            message: 'Internal sync error',
            error: msg
        }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}

