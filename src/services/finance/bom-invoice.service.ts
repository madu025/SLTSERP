import { prisma } from '@/lib/prisma';
import { ProjectInvoiceService } from '../project/project-invoice.service';

export class BOMInvoiceService {
    /**
     * Parse SLT BOM Excel row data, update matched SODs to PAT_PASSED, and generate Client Invoice for SLT
     */
    static async processBOMImport(rows: Record<string, unknown>[], userId: string, bomPath?: string) {
        if (!rows || rows.length === 0) {
            throw new Error('NO_ROWS_PROVIDED');
        }

        // 1. Find or create the default operational project
        const defaultProject = await prisma.project.upsert({
            where: { projectCode: 'OPS-SERV-GL' },
            update: {},
            create: {
                projectCode: 'OPS-SERV-GL',
                name: 'Operational Services & BOM Invoicing',
                status: 'IN_PROGRESS',
                type: 'OPERATIONAL',
                description: 'System default project for operational and BOM-based billing'
            }
        });

        // 2. Extract unique Service Order Numbers (soNum) from the sheet rows
        const soNumsRaw = rows.map(row => {
            return String(
                row['SO Number'] ||
                row['SO_NUM'] ||
                row['Service Order'] ||
                row['soNum'] ||
                row['SOD'] ||
                ''
            ).trim();
        });

        const uniqueSoNums = Array.from(new Set(soNumsRaw.filter(Boolean)));
        if (uniqueSoNums.length === 0) {
            throw new Error('NO_SERVICE_ORDERS_FOUND_IN_SHEET');
        }

        // 3. Query matching ServiceOrder records from the database
        const serviceOrders = await prisma.serviceOrder.findMany({
            where: {
                soNum: {
                    in: uniqueSoNums
                }
            },
            include: {
                opmc: true
            }
        });

        const matchedSoNums = new Set(serviceOrders.map(so => so.soNum.toLowerCase()));
        const unmatchedSoNums = uniqueSoNums.filter(soNum => !matchedSoNums.has(soNum.toLowerCase()));
        const warnings = unmatchedSoNums.map(soNum => `Service Order "${soNum}" not found in database.`);

        if (serviceOrders.length === 0) {
            return {
                success: false,
                invoicesCreated: 0,
                matchedCount: 0,
                totalRevenue: 0,
                warnings: [
                    ...warnings,
                    'All service connection orders from the sheet were unmatched. No invoice generated.'
                ]
            };
        }

        // 4. Fetch active OPMC revenue configs for flat billing rate calculation
        const revenueConfigs = await prisma.sODRevenueConfig.findMany({
            where: { isActive: true }
        });

        const getRevenueRateForOpmc = (opmcId: string | null) => {
            if (opmcId) {
                const match = revenueConfigs.find(c => c.rtomId === opmcId);
                if (match) return match.revenuePerSOD;
            }
            const fallback = revenueConfigs.find(c => c.rtomId === null);
            return fallback ? fallback.revenuePerSOD : 5500; // default flat rate fallback
        };

        // 5. Group matched ServiceOrders by OPMC to generate aggregated invoice items
        const opmcGroups: Record<string, { opmcName: string; opmcId: string | null; count: number; rate: number }> = {};
        const matchedIds: string[] = [];

        for (const so of serviceOrders) {
            matchedIds.push(so.id);
            const opmcId = so.opmcId || 'GLOBAL';
            const opmcName = so.opmc?.name || 'Standard Regional OPMC';
            const rate = getRevenueRateForOpmc(so.opmcId);

            if (!opmcGroups[opmcId]) {
                opmcGroups[opmcId] = {
                    opmcName,
                    opmcId: so.opmcId,
                    count: 0,
                    rate
                };
            }
            opmcGroups[opmcId].count++;
        }

        const invoiceItems = Object.values(opmcGroups).map(g => ({
            description: `PAT-Passed connections for OPMC: ${g.opmcName} (Qty: ${g.count})`,
            quantity: g.count,
            unitPrice: g.rate,
            itemType: 'SERVICE' as const
        }));

        // 6. Update matched ServiceOrders to PAT_PASSED and mark as invoicable
        await prisma.serviceOrder.updateMany({
            where: { id: { in: matchedIds } },
            data: {
                sltsPatStatus: 'PAT_PASSED',
                hoPatStatus: 'APPROVED',
                isInvoicable: true,
                sltsPatDate: new Date()
            }
        });

        // 7. Create Client ProjectInvoice
        const invoice = await ProjectInvoiceService.createInvoice({
            projectId: defaultProject.id,
            title: `SLT Client Billing (BOM Import) - ${new Date().toLocaleDateString()}`,
            description: `Billing claim generated from SLT BOM sheet. Matches ${serviceOrders.length} PAT-passed connections.`,
            type: 'CLIENT',
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days due
            items: invoiceItems,
            createdById: userId,
            referenceNumber: bomPath || null
        });

        return {
            success: true,
            invoicesCreated: 1,
            clientInvoiceNumber: invoice.invoiceNumber,
            matchedCount: serviceOrders.length,
            totalRevenue: invoice.totalAmount,
            warnings
        };
    }

    /**
     * Parse raw CSV text and generate Client Invoice summary
     */
    static async processBOMCSVImport(csvText: string, userId: string, bomPath?: string) {
        if (!csvText || typeof csvText !== 'string') {
            throw new Error('INVALID_CSV_TEXT');
        }

        const lines = csvText.split(/\r?\n/);
        if (lines.length === 0) {
            throw new Error('EMPTY_CSV');
        }

        // Clean headers and fields
        const parseRow = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseRow(lines[0]);
        const rows: Record<string, unknown>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseRow(line);
            const row: Record<string, unknown> = {};
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                if (header) {
                    row[header] = values[j] || '';
                }
            }
            rows.push(row);
        }

        return await this.processBOMImport(rows, userId, bomPath);
    }
}
