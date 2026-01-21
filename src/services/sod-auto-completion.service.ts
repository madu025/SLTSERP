import { prisma } from '@/lib/prisma';
import { NotificationService } from './notification.service';

interface SLTCompletedSOD {
    SO_NUM: string;
    RTOM: string;
    LEA: string;
    VOICENUMBER: string;
    ORDER_TYPE: string;
    S_TYPE: string;
    CON_CUS_NAME: string;
    CON_TEC_CONTACT: string;
    CON_STATUS: string;
    CON_STATUS_DATE: string;
    ADDRE: string;
    DP: string;
    PKG: string;
    CON_OSP_PHONE_CLASS: string;
    CON_PHN_PURCH: string;
    CON_SALES: string;
    CON_WORO_TASK_NAME: string;
    IPTV: string;
    CON_WORO_SEIT: string;
}

interface SLTApiResponse {
    data: SLTCompletedSOD[];
}

export class SODAutoCompletionService {
    private static isRunning = false;
    private static intervalId: NodeJS.Timeout | null = null;

    /**
     * Fetch completed SODs from SLT API
     */
    static async fetchCompletedSODsFromSLT(
        rtom: string,
        startDate: string,
        endDate: string
    ): Promise<SLTCompletedSOD[]> {
        try {
            const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load`;
            const params = new URLSearchParams({
                x: 'ftth',
                z: `${rtom}_${startDate}_${endDate}_COMPLETED_SLTS`,
                _: Date.now().toString()
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'SLTSERP/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`SLT API returned ${response.status}`);
            }

            const result: SLTApiResponse = await response.json();
            return result.data || [];
        } catch (error) {
            console.error('[SOD-AUTO-COMPLETE] Failed to fetch from SLT API:', error);
            return [];
        }
    }

    /**
     * Process and auto-complete matching SODs
     */
    static async processCompletedSODs(): Promise<{
        checked: number;
        completed: number;
        errors: string[];
    }> {
        if (this.isRunning) {
            console.log('[SOD-AUTO-COMPLETE] Already running, skipping...');
            return { checked: 0, completed: 0, errors: [] };
        }

        this.isRunning = true;
        console.log('[SOD-AUTO-COMPLETE] Starting auto-completion check...');

        const errors: string[] = [];
        let completedCount = 0;

        try {
            // Get all OPMCs
            const opmcs = await prisma.oPMC.findMany({
                select: { id: true, name: true }
            });

            // Date range: last 7 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            for (const opmc of opmcs) {
                try {
                    console.log(`[SOD-AUTO-COMPLETE] Checking OPMC: ${opmc.name}`);

                    // Fetch completed SODs from SLT
                    const completedSODs = await this.fetchCompletedSODsFromSLT(
                        opmc.id,
                        startDateStr,
                        endDateStr
                    );

                    console.log(`[SOD-AUTO-COMPLETE] Found ${completedSODs.length} completed SODs from SLT`);

                    // Process each completed SOD
                    for (const sltSOD of completedSODs) {
                        try {
                            // Find matching SOD in local database
                            const localSOD = await prisma.serviceOrder.findFirst({
                                where: {
                                    soNum: sltSOD.SO_NUM,
                                    status: 'PENDING' // Only auto-complete pending SODs
                                }
                            });

                            if (!localSOD) {
                                continue; // SOD not found or already completed
                            }

                            // Use existing ServiceOrderService to maintain consistency
                            const { ServiceOrderService } = await import('./sod.service');

                            await ServiceOrderService.patchServiceOrder(
                                localSOD.id,
                                {
                                    status: 'COMPLETED',
                                    sltsStatus: 'COMPLETED',
                                    completedDate: new Date(sltSOD.CON_STATUS_DATE),
                                    sltsPatStatus: sltSOD.CON_STATUS,
                                },
                                'SYSTEM_AUTO_COMPLETE' // System user ID for audit
                            );

                            completedCount++;

                            // Send notification
                            await NotificationService.notifyByRole({
                                roles: ['OSP_MANAGER', 'OFFICE_ADMIN', 'ADMIN'],
                                title: 'SOD Auto-Completed',
                                message: `SOD ${sltSOD.SO_NUM} has been automatically completed based on SLT data.`,
                                type: 'PROJECT',
                                priority: 'MEDIUM',
                                link: `/service-orders/completed`
                            });

                            console.log(`[SOD-AUTO-COMPLETE] ✅ Completed: ${sltSOD.SO_NUM}`);

                        } catch (error) {
                            const errorMsg = `Failed to process ${sltSOD.SO_NUM}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                            errors.push(errorMsg);
                            console.error(`[SOD-AUTO-COMPLETE] ❌ ${errorMsg}`);
                        }
                    }

                } catch (error) {
                    const errorMsg = `Failed to process OPMC ${opmc.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.error(`[SOD-AUTO-COMPLETE] ❌ ${errorMsg}`);
                }
            }

            console.log(`[SOD-AUTO-COMPLETE] ✅ Completed ${completedCount} SODs`);

            return {
                checked: opmcs.length,
                completed: completedCount,
                errors
            };

        } catch (error) {
            console.error('[SOD-AUTO-COMPLETE] Fatal error:', error);
            return {
                checked: 0,
                completed: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start background process (10-minute intervals)
     */
    static startBackgroundProcess(): void {
        if (this.intervalId) {
            console.log('[SOD-AUTO-COMPLETE] Background process already running');
            return;
        }

        console.log('[SOD-AUTO-COMPLETE] Starting background process (10-minute intervals)');

        // Run immediately on start
        this.processCompletedSODs();

        // Then run every 10 minutes
        this.intervalId = setInterval(() => {
            this.processCompletedSODs();
        }, 10 * 60 * 1000); // 10 minutes
    }

    /**
     * Stop background process
     */
    static stopBackgroundProcess(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[SOD-AUTO-COMPLETE] Background process stopped');
        }
    }

    /**
     * Get process status
     */
    static getStatus(): { isRunning: boolean; hasInterval: boolean } {
        return {
            isRunning: this.isRunning,
            hasInterval: this.intervalId !== null
        };
    }
}
