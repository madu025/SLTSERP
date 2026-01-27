import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * SLT-ERP PHOENIX BRIDGE SYNC
 * Receives detailed capture from the Chrome Extension
 */
export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const { soNum, allTabs, teamDetails, url, currentUser } = payload;

        if (!soNum) {
            return NextResponse.json({ message: 'Service Order Number is required' }, { status: 400 });
        }

        console.log(`[BRIDGE-SYNC] Processing sync for SO: ${soNum}`);

        // 1. Flatten all tabs into a single data object for mapping
        const masterData: Record<string, string> = {};
        if (allTabs) {
            Object.values(allTabs).forEach((tabData: any) => {
                Object.assign(masterData, tabData);
            });
        }

        // 2. Map Bridge Keys to ServiceOrder Model
        const mapping: Partial<Prisma.ServiceOrderUncheckedCreateInput> = {
            rtom: masterData['RTOM'],
            lea: masterData['LEA'],
            voiceNumber: masterData['CIRCUIT'] || masterData['VOICE NUMBER'],
            orderType: masterData['ORDER TYPE'],
            serviceType: masterData['SERVICE TYPE'] || masterData['SERVICE'],
            customerName: masterData['CUSTOMER NAME'],
            techContact: masterData['CONTACT NO'] || masterData['CONTACT NUMBER'],
            address: masterData['ADDRESS'],
            status: masterData['STATUS'],
            package: masterData['PACKAGE'],
            iptv: masterData['IPTV'],
            ontSerialNumber: masterData['ONT'] || masterData['ONT SERIAL'] || masterData['SERIAL'],
            iptvSerialNumbers: masterData['IPTV SERIAL'] || masterData['STB SERIAL'],
            sales: masterData['SALES PERSON'] || masterData['SALES'],
        };

        // 3. Find or Create the Service Order
        let serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum }
        });

        // Resolve OPMC
        let opmcId = serviceOrder?.opmcId;
        if (!opmcId && masterData['RTOM']) {
            const opmc = await prisma.oPMC.findFirst({
                where: { rtom: { contains: (masterData['RTOM'] || '').substring(0, 4), mode: 'insensitive' } }
            });
            opmcId = opmc?.id;
        }

        // Default OPMC fallback
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
        if (masterData['RECEIVED DATE']) {
            try { dataToUpdate.receivedDate = new Date(masterData['RECEIVED DATE']); } catch { /* ignore */ }
        }
        if (masterData['STATUS DATE']) {
            try { dataToUpdate.statusDate = new Date(masterData['STATUS DATE']); } catch { /* ignore */ }
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

        // 4. Save/Update Raw Data Dump for Monitor
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
            message: 'Bridge sync complete'
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
