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
        'EQUIPMENT PURCHASE FROM SLT', 'SALES PERSON', 'DP LOOP'
    ];

    keywords.forEach((key, idx) => {
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

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const { soNum, allTabs, teamDetails, url, currentUser } = payload;

        if (!soNum) {
            return NextResponse.json({ message: 'Service Order Number is required' }, { status: 400 });
        }

        console.log(`[BRIDGE-SYNC] Processing sync for SO: ${soNum}`);

        // 1. Flatten all tabs into a single data object
        const masterData: Record<string, string> = {};
        if (allTabs) {
            Object.values(allTabs).forEach((tabData: any) => {
                Object.assign(masterData, tabData);
            });
        }

        // 2. Deep Parsing Strategy (Fixing Portal Mashing)
        const deepData = deepParse(masterData);

        // 3. Map Bridge Keys to ServiceOrder Model with mash-recovery
        const mapping: Partial<Prisma.ServiceOrderUncheckedCreateInput> = {
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
            iptvSerialNumbers: masterData['IPTV SERIAL'] || masterData['STB SERIAL'],
            sales: masterData['SALES PERSON'] || masterData['SALES'] || deepData['SALES PERSON'],
        };

        // 4. Find or Create the Service Order
        let serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum }
        });

        // Resolve OPMC
        let opmcId = serviceOrder?.opmcId;
        const rtomVal = mapping.rtom as string;
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

        // Match Team
        if (teamDetails?.['SELECTED TEAM']) {
            const teamName = teamDetails['SELECTED TEAM'];
            const teamCode = teamName.split('-')[0].trim();
            const team = await prisma.contractorTeam.findFirst({
                where: { OR: [{ name: teamName }, { sltCode: teamCode }] }
            });
            if (team) {
                dataToUpdate.teamId = team.id;
                dataToUpdate.contractorId = team.contractorId;
            }
        }

        if (serviceOrder) {
            serviceOrder = await prisma.serviceOrder.update({
                where: { id: serviceOrder.id },
                data: dataToUpdate
            });
        } else {
            serviceOrder = await prisma.serviceOrder.create({
                data: {
                    ...(dataToUpdate as Prisma.ServiceOrderUncheckedCreateInput),
                    soNum,
                    status: (dataToUpdate.status as string) || 'PENDING',
                    sltsStatus: 'INPROGRESS'
                }
            });
        }

        // 5. Save/Update Raw Data Dump for Monitor
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
            id: serviceOrder.id,
            soNum: serviceOrder.soNum,
            message: 'Bridge sync complete (Deep-Parse Active)'
        });

    } catch (error: any) {
        console.error('[BRIDGE-SYNC] Fatal Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Internal sync error',
            error: error.message
        }, { status: 500 });
    }
}
