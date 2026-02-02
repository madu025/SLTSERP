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

export async function POST(request: Request) {
    try {
        interface BridgeSyncPayload {
            soNum: string;
            allTabs?: Record<string, string>;
            teamDetails?: Record<string, string>;
            materialDetails?: Array<{ TYPE?: string; CODE?: string; NAME?: string; QTY?: string; qty?: string | number }>;
            forensicAudit?: Array<Record<string, unknown>>;
            url?: string;
            currentUser?: string;
            activeTab?: string;
        }

        const payload = (await request.json()) as BridgeSyncPayload;
        const { soNum, allTabs, teamDetails, forensicAudit, url, currentUser } = payload;

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
            ontSerialNumber: masterData['ONT'] || masterData['ONT SERIAL'] || masterData['SERIAL'] || masterData['ONT_ROUTER_SERIAL_NUMBER'],
            iptvSerialNumbers: masterData['IPTV SERIAL'] || masterData['STB SERIAL'] || masterData['IPTV_CPE_SERIAL_NUMBER_1'],
            dpDetails: masterData['DP LOOP'] || masterData['DP'] || deepData['DP LOOP'] || masterData['DP_DETAILS'] || masterData['CONNECTION POINT (DP)'],
            sales: masterData['SALES PERSON'] || masterData['SALES'] || deepData['SALES PERSON'],
        };

        // Handle Pole Serial Number (Mapped to Comments to avoid DB Schema Change)
        const poleSerial = masterData['POLE_SERIAL_NUMBER'] || masterData['POLE_SERIAL'] || deepData['POLE'];
        if (poleSerial) {
            mapping.comments = (mapping.comments ? mapping.comments + " | " : "") + `Pole Serial: ${poleSerial}`;
        }

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
        const isServiceReturn = masterData['SERVICE RETURN'] === 'on' || masterData['IS_RETURN'] === 'on';

        if (isServiceReturn) {
            console.log(`[BRIDGE-SYNC] Auto-Pilot: Detected RETURN Service Order: ${soNum}`);
            mapping.sltsStatus = 'RETURN';
            mapping.returnReason = masterData['RTRESONALL_HIDDEN'] || masterData['RETURN REASON'] || 'CUSTOMER NOT READY';
            mapping.comments = masterData['RTCMTALL_HIDDEN'] || masterData['RETURN COMMENT'] || 'Customer delays';
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

        let syncedOrder: { id: string; soNum: string; sltsStatus: string } | null = null;
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

        // 7.1 Auto-Pilot sltsStatus reinforcement
        if (dataToUpdate.completedDate && syncedOrder && syncedOrder.sltsStatus !== 'COMPLETED') {
            await prisma.serviceOrder.update({
                where: { id: syncedOrder.id },
                data: { sltsStatus: 'COMPLETED' }
            });
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

            // ERROR FIX: Deduplicate payload before processing
            const uniqueMaterials = new Map<string, typeof materialDetails[0]>();

            materialDetails.forEach(mat => {
                const code = (mat.CODE || mat.TYPE || mat.NAME || "").trim();
                const key = code.toUpperCase();
                // If duplicates exist, we might want to sum quantities or take the last one. 
                // Usually for this sync, taking the last valid one or just one is fine. 
                // Let's assume unique items.
                if (key && !uniqueMaterials.has(key)) {
                    uniqueMaterials.set(key, mat);
                }
            });

            for (const mat of uniqueMaterials.values()) {
                const code = mat.CODE || mat.TYPE;
                const name = mat.NAME;
                const qty = parseFloat(mat.QTY || "0");

                if (qty > 0 && (code || name)) {
                    // Try to find matching ERP Item
                    const item = await prisma.inventoryItem.findFirst({
                        where: {
                            OR: [
                                { code: { equals: code, mode: 'insensitive' } },
                                { name: { equals: name, mode: 'insensitive' } },
                                { importAliases: { has: code || "" } }
                            ]
                        }
                    });

                    if (item) {
                        await prisma.sODMaterialUsage.create({
                            data: {
                                serviceOrderId: syncedOrder.id,
                                itemId: item.id,
                                quantity: qty,
                                unit: item.unit || "Nos",
                                usageType: 'PORTAL_SYNC',
                                unitPrice: item.unitPrice || 0,
                                costPrice: item.costPrice || 0,
                                comment: 'Auto-synced from SLT Portal'
                            }
                        });
                    }
                }
            }
        }

        // 10. Save/Update Raw Data Dump for Monitor
        const existingLog = await prisma.extensionRawData.findFirst({
            where: { soNum: soNum }
        });

        if (existingLog) {
            await prisma.extensionRawData.update({
                where: { id: existingLog.id },
                data: {
                    sltUser: currentUser,
                    activeTab: payload.activeTab,
                    scrapedData: payload,
                    url,
                    updatedAt: new Date()
                }
            });
        } else {
            await prisma.extensionRawData.create({
                data: {
                    soNum,
                    sltUser: currentUser,
                    activeTab: payload.activeTab,
                    scrapedData: payload,
                    url
                }
            });
        }

        return NextResponse.json({
            success: true,
            id: syncedOrder?.id,
            soNum: syncedOrder?.soNum,
            message: 'Bridge sync successful. Core tables updated.'
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

