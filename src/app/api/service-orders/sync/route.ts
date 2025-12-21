import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sltApiService } from '@/services/slt-api.service';

// POST - Sync service orders from SLT API
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { opmcId, rtom } = body;

        if (!opmcId || !rtom) {
            return NextResponse.json({
                message: 'OPMC ID and RTOM are required'
            }, { status: 400 });
        }

        // Fetch data from SLT API
        const sltData = await sltApiService.fetchServiceOrders(rtom);

        if (sltData.length === 0) {
            return NextResponse.json({
                message: 'No data received from SLT API',
                synced: 0,
                updated: 0,
                created: 0
            });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;

        // Process in batches to avoid overwhelming database
        const batchSize = 50;
        for (let i = 0; i < sltData.length; i += batchSize) {
            const batch = sltData.slice(i, i + batchSize);

            await prisma.$transaction(async (tx) => {
                for (const item of batch) {
                    try {
                        const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);

                        // Upsert: create if not exists, update if status changed
                        const result = await tx.serviceOrder.upsert({
                            where: {
                                soNum_status: {
                                    soNum: item.SO_NUM,
                                    status: item.CON_STATUS
                                }
                            },
                            update: {
                                lea: item.LEA,
                                voiceNumber: item.VOICENUMBER,
                                orderType: item.ORDER_TYPE,
                                serviceType: item.S_TYPE,
                                customerName: item.CON_CUS_NAME,
                                techContact: item.CON_TEC_CONTACT,
                                statusDate,
                                address: item.ADDRE,
                                dp: item.DP,
                                package: item.PKG,
                                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                                phonePurchase: item.CON_PHN_PURCH,
                                sales: item.CON_SALES,
                                woroTaskName: item.CON_WORO_TASK_NAME,
                                iptv: item.IPTV,
                                woroSeit: item.CON_WORO_SEIT,
                                ftthInstSeit: item.FTTH_INST_SIET,
                                ftthWifi: item.FTTH_WIFI,
                                // Don't update sltsStatus - preserve user's status changes
                            },
                            create: {
                                opmcId,
                                rtom: item.RTOM,
                                lea: item.LEA,
                                soNum: item.SO_NUM,
                                voiceNumber: item.VOICENUMBER,
                                orderType: item.ORDER_TYPE,
                                serviceType: item.S_TYPE,
                                customerName: item.CON_CUS_NAME,
                                techContact: item.CON_TEC_CONTACT,
                                status: item.CON_STATUS,
                                statusDate,
                                address: item.ADDRE,
                                dp: item.DP,
                                package: item.PKG,
                                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                                phonePurchase: item.CON_PHN_PURCH,
                                sales: item.CON_SALES,
                                woroTaskName: item.CON_WORO_TASK_NAME,
                                iptv: item.IPTV,
                                woroSeit: item.CON_WORO_SEIT,
                                ftthInstSeit: item.FTTH_INST_SIET,
                                ftthWifi: item.FTTH_WIFI,
                                sltsStatus: 'INPROGRESS', // New orders start with INPROGRESS status
                            }
                        });

                        // Check if it was created or updated
                        const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
                        if (wasCreated) {
                            created++;
                        } else {
                            updated++;
                        }
                    } catch (error) {
                        console.error(`Error upserting SO ${item.SO_NUM}:`, error);
                        skipped++;
                    }
                }
            });
        }

        return NextResponse.json({
            message: 'Sync completed',
            total: sltData.length,
            created,
            updated,
            skipped
        });
    } catch (error) {
        console.error('Error syncing service orders:', error);
        return NextResponse.json({
            message: 'Error syncing service orders',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
