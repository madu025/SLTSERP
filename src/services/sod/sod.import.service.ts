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
                const soNum = String(item['SO Number'] || item['SO_NUM'] || '').trim();
                if (!soNum) continue;

                // Simple check for completion in Excel
                const excelStatus = String(item['Status'] || item['CON_STATUS'] || '');
                const completionStatuses = ['INSTALL_CLOSED', 'COMPLETED', 'FINISHED'];
                const isCompleted = completionStatuses.includes(excelStatus.toUpperCase());

                await prisma.serviceOrder.upsert({
                    where: { soNum },
                    create: {
                        soNum,
                        rtom: rtom,
                        opmcId: opmcId,
                        status: excelStatus,
                        sltsStatus: isCompleted ? 'COMPLETED' : 'INPROGRESS',
                        voiceNumber: String(item['Voice Number'] || item['VOICENUMBER'] || ''),
                        orderType: String(item['Order Type'] || item['ORDER_TYPE'] || ''),
                        serviceType: String(item['Service Type'] || item['S_TYPE'] || ''),
                        customerName: String(item['Customer Name'] || item['CON_CUS_NAME'] || ''),
                        address: String(item['Address'] || item['ADDRE'] || ''),
                        dp: String(item['DP'] || item['DP'] || ''),
                        package: String(item['Package'] || item['PKG'] || ''),
                        receivedDate: new Date(),
                        completedDate: isCompleted ? new Date() : null,
                    },
                    update: {
                        status: excelStatus,
                        sltsStatus: isCompleted ? 'COMPLETED' : undefined,
                        completedDate: isCompleted ? new Date() : undefined,
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
