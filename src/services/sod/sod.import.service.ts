import { prisma } from '@/lib/prisma';
import { addJob, statsUpdateQueue } from '../../lib/queue';

export class SODImportService {
    /**
     * Bulk Import from Excel data
     */
    static async bulkImportServiceOrders(rtom: string, data: Record<string, unknown>[], opmcId: string) {
        let created = 0;
        let failed = 0;
        const errors: string[] = [];

        console.log(`[BULK-IMPORT] Processing ${data.length} records for RTOM: ${rtom}`);

        for (const item of data) {
            try {
                const soNum = String(item['SO Number'] || item['SO_NUM'] || item['SOD'] || '').trim();
                if (!soNum) continue;

                // Simple check for completion in Excel
                const excelStatus = String(item['Status'] || item['CON_STATUS'] || '');
                const completionStatuses = ['INSTALL_CLOSED', 'COMPLETED', 'FINISHED'];
                const isCompleted = completionStatuses.includes(excelStatus.toUpperCase());

                const voiceNumber = String(item['Voice Number'] || item['VOICENUMBER'] || item['CIRCUIT'] || '');
                const orderType = String(item['Order Type'] || item['ORDER_TYPE'] || item['TASK_TYPE'] || '');
                const serviceType = String(item['Service Type'] || item['S_TYPE'] || item['SERVICE'] || '');
                const customerName = String(item['Customer Name'] || item['CON_CUS_NAME'] || item['CUS_NAME'] || '');
                const address = String(item['Address'] || item['ADDRE'] || item['CUS_ADDR'] || '');
                const dp = String(item['DP'] || item['DP_NAME'] || '');
                const pkg = String(item['Package'] || item['PKG'] || item['S_PKG'] || '');
                const lea = String(item['LEA'] || item['LEA_NAME'] || '');
                const woroTaskName = String(item['WORO Task Name'] || item['TASK'] || '');
                const techContact = String(item['Tech Contact'] || item['TECH_NO'] || '');
                const sales = String(item['Sales'] || item['SALES_PERSON'] || '');

                await prisma.serviceOrder.upsert({
                    where: { soNum },
                    create: {
                        soNum,
                        rtom: rtom,
                        opmcId: opmcId,
                        status: excelStatus,
                        sltsStatus: isCompleted ? 'COMPLETED' : 'INPROGRESS',
                        voiceNumber,
                        orderType,
                        serviceType,
                        customerName,
                        address,
                        dp,
                        package: pkg,
                        lea,
                        woroTaskName,
                        techContact,
                        sales,
                        receivedDate: new Date(),
                        completedDate: isCompleted ? new Date() : null,
                    },
                    update: {
                        status: excelStatus,
                        sltsStatus: isCompleted ? 'COMPLETED' : undefined,
                        completedDate: isCompleted ? new Date() : undefined,
                        voiceNumber,
                        orderType,
                        serviceType,
                        customerName,
                        address,
                        dp,
                        package: pkg,
                        lea,
                        woroTaskName,
                        techContact,
                        sales,
                    }
                });
                created++;
            } catch (err) {
                failed++;
                errors.push(err instanceof Error ? err.message : String(err));
            }
        }

        if (created > 0) {
            await addJob(statsUpdateQueue, `stats-${opmcId}`, {
                opmcId,
                type: 'SINGLE_OPMC'
            }, { jobId: `stats-${opmcId}-${new Date().toISOString().split('T')[0]}` });
        }

        return { rtom, created, failed, errors: errors.slice(0, 5) };
    }
}
