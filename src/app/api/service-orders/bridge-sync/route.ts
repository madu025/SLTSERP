/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { bridgeSyncSchema } from '@/lib/validations/service-order.schema';

// ... (deepParse function remains identical)
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
        for (let j = 0; j < keywords.length; j++) {
            const nextKey = keywords[j];
            const nextIdx = mashed.indexOf(nextKey, start + key.length);
            if (nextIdx !== -1 && nextIdx < end) {
                end = nextIdx;
            }
        }

        let val = mashed.substring(start + key.length, end).trim();
        if (key === 'RTOM') val = val.replace('R-', '');
        if (key === 'CIRCUIT') val = val.split(' ')[0];

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
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role',
        },
    });
}

export const GET = apiHandler(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const soNum = searchParams.get('soNum');

    if (!soNum) {
        throw new Error('soNum is required');
    }

    const rawData = await prisma.extensionRawData.findFirst({
        where: { soNum },
        orderBy: { updatedAt: 'desc' }
    });

    if (!rawData) {
        return { success: false, message: 'No bridge data found' };
    }

    const scraped = (rawData.scrapedData as any);
    return {
        success: true,
        materialDetails: scraped?.materialDetails || [],
        forensicAudit: scraped?.forensicAudit || [],
        lastSynced: rawData.updatedAt
    };
});

export const POST = apiHandler(async (_req, _params, payload: any) => {
    const { soNum, allTabs, teamDetails, forensicAudit } = payload;

    console.log(`[BRIDGE-SYNC] Processing sync for SO: ${soNum}`);

    // 1. Flatten all tabs into a single data object
    const masterData: Record<string, string> = {};
    if (allTabs) {
        Object.values(allTabs).forEach((tabData: any) => {
            if (tabData && typeof tabData === 'object') {
                Object.assign(masterData, tabData);
            }
        });
    }

    // 2. Deep Parsing Strategy 
    const deepData = deepParse(masterData);

    // 3. Map Bridge Keys 
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

    // 4. Find existing order
    const serviceOrder = await prisma.serviceOrder.findUnique({
        where: { soNum },
        include: { materialUsage: true }
    });

    // 5. Contractor Sync
    const capturedContractorName = masterData['CON_NAME'] || masterData['CONTRACTOR'] || masterData['CONTRACTOR NAME'] || masterData['CONTRACTOR_NAME'];
    if (capturedContractorName && (!mapping.contractorId || mapping.contractorId === "")) {
        const contractor = await prisma.contractor.findFirst({
            where: { name: { contains: capturedContractorName.trim(), mode: 'insensitive' } }
        });
        if (contractor) mapping.contractorId = contractor.id;
    }

    // 6. Return Logic
    const isServiceReturn =
        masterData['SERVICE RETURN'] === 'on' ||
        masterData['IS_RETURN'] === 'on' ||
        masterData['CHKSODRTN_HIDDEN'] === 'on' ||
        masterData['CHKSODRTN'] === 'on';

    if (isServiceReturn) {
        mapping.sltsStatus = 'RETURN';
        mapping.returnReason = masterData['RTRESONALL_HIDDEN'] || masterData['SOD RETURN'] || masterData['RETURN REASON'] || 'CUSTOMER NOT READY';
        mapping.comments = masterData['RTCMTALL_HIDDEN'] || masterData['RETURN COMMENT'] || 'Customer delays';
        if (!serviceOrder?.completedDate) mapping.completedDate = new Date();
    }

    // 6.1 Distance
    const materialDetails = payload.materialDetails || [];
    const dropWireItem = materialDetails.find((m: any) => {
        const type = (m.TYPE || m.NAME || "").toUpperCase();
        return type && (type.includes('DROP WIRE') || type.includes('DWIRE') || type.includes('DW'));
    });

    if (dropWireItem && (dropWireItem.QTY || dropWireItem.qty)) {
        const qty = parseFloat(dropWireItem.QTY || String(dropWireItem.qty));
        if (!isNaN(qty)) mapping.dropWireDistance = qty;
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
        rtom: (mapping.rtom as string) || serviceOrder?.rtom || 'UNKNOWN',
        opmcId,
        updatedAt: new Date(),
    };

    // Dates
    const safeParseDate = (dateStr: string | undefined | null) => {
        if (!dateStr || dateStr.trim() === "") return undefined;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? undefined : d;
    };

    const rcvDate = safeParseDate(masterData['RECEIVED DATE'] || deepData['RECEIVED DATE']);
    if (rcvDate) (dataToUpdate as any).receivedDate = rcvDate;

    const stDate = safeParseDate(masterData['STATUS DATE'] || deepData['STATUS DATE']);
    if (stDate) (dataToUpdate as any).statusDate = stDate;

    // Automations
    if (mapping.status === 'COMPLETED' || mapping.status === 'INSTALL_CLOSED' || mapping.status === 'PROV_CLOSED') {
        if (!mapping.sltsStatus) dataToUpdate.sltsStatus = 'COMPLETED';
        const d = safeParseDate(masterData['COMPLETED DATE'] || masterData['COMPLETED_DATE'] || stDate);
        if (d) (dataToUpdate as any).completedDate = d;
        if (dataToUpdate.completedDate) dataToUpdate.sltsStatus = 'COMPLETED';
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
    let syncedOrder: any = null;
    if (serviceOrder) {
        syncedOrder = await prisma.serviceOrder.update({
            where: { id: serviceOrder.id },
            data: dataToUpdate
        });
    } else {
        syncedOrder = await prisma.serviceOrder.create({
            data: {
                ...(dataToUpdate as Prisma.ServiceOrderUncheckedCreateInput),
                soNum,
                status: (dataToUpdate.status as string) || 'PENDING',
                sltsStatus: 'INPROGRESS'
            }
        });
    }

    // 7.1 Stats & Notifications
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
        } catch { /* ignore */ }
    }

    // 8. Forensic Audit Save
    const voiceStatus = masterData['VOICE_TEST_RESULT'] || masterData['VOICE TEST'] || null;
    if (forensicAudit && forensicAudit.length > 0) {
        const forensicModel = (prisma as any).sODForensicAudit;
        if (forensicModel) {
            await forensicModel.upsert({
                where: { soNum },
                update: { auditData: forensicAudit, voiceTestStatus: voiceStatus, updatedAt: new Date() },
                create: { soNum, auditData: forensicAudit, voiceTestStatus: voiceStatus }
            });
        }
    }

    // 9. Material Sync
    if (materialDetails.length > 0 && syncedOrder) {
        await prisma.sODMaterialUsage.deleteMany({
            where: { serviceOrderId: syncedOrder.id, usageType: 'PORTAL_SYNC' }
        });

        for (const mat of materialDetails) {
            const code = mat.CODE || mat.TYPE;
            const name = mat.NAME;
            const qty = parseFloat(mat.QTY || "0");

            if (qty > 0 && (code || name)) {
                let item = await prisma.inventoryItem.findFirst({
                    where: {
                        OR: [
                            { code: { equals: code, mode: 'insensitive' } },
                            { name: { equals: name, mode: 'insensitive' } },
                            { importAliases: { has: code || "" } },
                            { importAliases: { has: name || "" } }
                        ]
                    }
                });

                if (!item) {
                    const searchKey = (name || code || "").toUpperCase();
                    let mappedCode = null;
                    for (const [key, val] of Object.entries(MATERIAL_MAP)) {
                        if (searchKey.includes(key)) { mappedCode = val; break; }
                    }
                    if (mappedCode) item = await prisma.inventoryItem.findFirst({ where: { code: mappedCode } });
                }

                const matSerial = mat.SERIAL || (mat.RAW ? (mat.RAW['SERIAL'] || mat.RAW['SERIAL NUMBER'] || mat.RAW['ONT_ROUTER_SERIAL_NUMBER_']) : null);
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
                            comment: `Auto-synced from Portal`
                        }
                    });
                }
            }
        }
    }

    // 10. Audit Log for Bridge Monitor
    try {
        const monitorModel = (prisma as any).extensionRawData;
        if (monitorModel) {
            await monitorModel.upsert({
                where: { soNum },
                update: { sltUser: payload.currentUser || null, activeTab: payload.activeTab || 'SYNC_PUSH', url: payload.url || null, scrapedData: payload, updatedAt: new Date() },
                create: { soNum, sltUser: payload.currentUser || null, activeTab: payload.activeTab || 'SYNC_PUSH', url: payload.url || null, scrapedData: payload }
            });
        }
    } catch { /* ignore */ }

    return {
        success: true,
        id: syncedOrder?.id,
        soNum: syncedOrder?.soNum,
        message: 'Bridge sync successful.'
    };
}, { schema: bridgeSyncSchema });

