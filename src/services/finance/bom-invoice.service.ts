import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { InvoiceGeneratorService } from '../invoice/invoice.generator.service';
import { ProjectInvoiceService } from '../project/project-invoice.service';

export class BOMInvoiceService {
    private static parseDateFromSoNum(soNum: string): Date {
        const match = soNum.match(/(202[3-6])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 0-indexed
            const day = parseInt(match[3], 10);
            return new Date(Date.UTC(year, month, day, 12, 0, 0));
        }
        return new Date();
    }

    /**
     * Parse SLT BOM Excel row data, update matched SODs to PAT_PASSED, and generate Client Invoice for SLT
     */
    static async processBOMImport(rows: Record<string, unknown>[], userId: string, bomPath?: string) {
        if (!rows || rows.length === 0) {
            throw AppError.badRequest('NO_ROWS_PROVIDED');
        }



        // Helper to normalize keys to uppercase and trimmed strings
        const cleanRows = rows.map(row => {
            const cleanRow: Record<string, string> = {};
            Object.entries(row).forEach(([key, val]) => {
                cleanRow[key.trim().toUpperCase()] = String(val || '').trim();
            });
            return cleanRow;
        });

        // 2. Extract unique Service Order Numbers (soNum) from the sheet rows
        const soNumsRaw = cleanRows.map(cleanRow => {
            return String(
                cleanRow['SOD'] ||
                cleanRow['SO NUMBER'] ||
                cleanRow['SO_NUM'] ||
                cleanRow['SERVICE ORDER'] ||
                cleanRow['SONUM'] ||
                ''
            ).trim();
        });

        const uniqueSoNums = Array.from(new Set(soNumsRaw.filter(Boolean)));
        if (uniqueSoNums.length === 0) {
            throw AppError.badRequest('NO_SERVICE_ORDERS_FOUND_IN_SHEET');
        }

        // 3. Query matching ServiceOrder records from the database
        let serviceOrders = await prisma.serviceOrder.findMany({
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

        // Dynamically create/stub ServiceOrders that do not exist in the database (backlog backlog support)
        if (unmatchedSoNums.length > 0) {
            const opmcs = await prisma.oPMC.findMany();
            const contractors = await prisma.contractor.findMany();
            
            const defaultOpmc = opmcs[0];
            const defaultContractor = contractors.find(c => c.name.toUpperCase() === 'SLTS') || contractors[0];
            
            if (!defaultOpmc) {
                throw AppError.badRequest('NO_OPMCS_FOUND_IN_DATABASE');
            }
            if (!defaultContractor) {
                throw AppError.badRequest('NO_CONTRACTORS_FOUND_IN_DATABASE');
            }

            const stubsToCreate = [];

            for (const soNum of unmatchedSoNums) {
                // Find the first row matching this soNum
                const row = cleanRows.find(r => {
                    const rowSoNum = String(
                        r['SOD'] ||
                        r['SO NUMBER'] ||
                        r['SO_NUM'] ||
                        r['SERVICE ORDER'] ||
                        r['SONUM'] ||
                        ''
                    ).trim();
                    return rowSoNum.toLowerCase() === soNum.toLowerCase();
                });

                if (!row) continue;

                // Parse properties
                const voiceNumber = row['CIRCUIT'] || row['VOICE NUMBER'] || row['VOICENUMBER'] || row['TELEPHONE'] || null;
                const rtom = row['RTOM'] || row['RTOM_AREA'] || row['RTOMAREA'] || 'GLOBAL';

                // Find OPMC
                let opmcId = defaultOpmc.id;
                const rtomUpper = rtom.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const matchedOpmc = opmcs.find(o => o.name.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(rtomUpper));
                if (matchedOpmc) {
                    opmcId = matchedOpmc.id;
                }

                // Find Contractor
                let contractorId = defaultContractor.id;
                const contractorName = row['CONTRACTOR'] || row['CONTRACTOR_NAME'] || '';
                if (contractorName) {
                    const matchedContractor = contractors.find(c => c.name.toUpperCase() === contractorName.toUpperCase());
                    if (matchedContractor) {
                        contractorId = matchedContractor.id;
                    }
                }

                // Drop wire distance
                const dwVal = parseFloat(row['FTTH-DW (M)'] || row['FTTH-DW'] || row['DROP WIRE DISTANCE'] || row['DROP_WIRE'] || '0');
                const dropWireDistance = isNaN(dwVal) ? 0 : dwVal;

                const parsedDate = BOMInvoiceService.parseDateFromSoNum(soNum);

                stubsToCreate.push({
                    soNum,
                    voiceNumber,
                    rtom,
                    status: 'COMPLETED',
                    sltsStatus: 'COMPLETED',
                    sltsPatStatus: 'PAT_PASSED',
                    hoPatStatus: 'APPROVED',
                    isInvoicable: true,
                    dropWireDistance,
                    opmcId,
                    contractorId,
                    isLegacyImport: true,
                    receivedDate: parsedDate,
                    completedDate: parsedDate,
                    statusDate: parsedDate,
                    comments: 'Auto-stubbed from BOM sheet backlog sync'
                });
            }

            if (stubsToCreate.length > 0) {
                await prisma.serviceOrder.createMany({
                    data: stubsToCreate,
                    skipDuplicates: true
                });

                // Retrieve the stubbed service orders to include in calculation
                const newServiceOrders = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: {
                            in: unmatchedSoNums
                        }
                    },
                    include: {
                        opmc: true
                    }
                });

                serviceOrders = [...serviceOrders, ...newServiceOrders];
            }
        }

        // 3.5. Extract and populate material usages for all matched and stubbed service orders
        const allItems = await prisma.inventoryItem.findMany();
        const metadataKeys = new Set([
            'SOD', 'SO NUMBER', 'SO_NUM', 'SERVICE ORDER', 'SONUM',
            'CIRCUIT', 'VOICE NUMBER', 'VOICENUMBER', 'TELEPHONE',
            'RTOM', 'RTOM_AREA', 'RTOMAREA',
            'CONTRACTOR', 'CONTRACTOR_NAME',
            'FTTH-DW (M)', 'FTTH-DW', 'DROP WIRE DISTANCE', 'DROP_WIRE'
        ]);

        const isMetadataKey = (key: string) => {
            const normKey = key.trim().toUpperCase().replace(/\s*\(.*\)$/, '').trim();
            return metadataKeys.has(normKey) || normKey === 'FTTH-DW';
        };

        const resolveItemFromHeader = (header: string) => {
            const cleanedHeader = header.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
            const normHeader = cleanedHeader.replace(/[^A-Z0-9]/g, '');

            let item = allItems.find(i => i.code.toUpperCase() === cleanedHeader);
            if (item) return item;

            item = allItems.find(i => i.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === normHeader);
            if (item) return item;

            item = allItems.find(i => i.importAliases.some(alias => alias.toUpperCase() === cleanedHeader));
            if (item) return item;

            item = allItems.find(i => i.importAliases.some(alias => alias.toUpperCase().replace(/[^A-Z0-9]/g, '') === normHeader));
            if (item) return item;

            const specialMappings: Record<string, string> = {
                'PLC56L': 'OSP-POLE-5.6LL',
                'PLC56CE': 'OSPCPL008',
                'PLC67': 'OSP-POLE-6.7LL',
                'PLC67CE': 'OSPCPL009',
                'PLC75': 'OSPCPL004',
                'PLC8': 'OSP-POLE-8MH',
                'PLCPOLE': 'OSP-POLE-5.6LL',
                'DWLH': 'OSPACC017',
                'FAC1': 'OSP-HC-ACC-FAC',
                'FWS1': 'OSPFTA007',
                'DWRT': 'OSP-NC-ACC-DWRETNER',
                'UTPTER': 'UTP-TER',
                'SCC5': 'OSP-HC-CBL-DW'
            };

            const mappedCode = specialMappings[normHeader];
            if (mappedCode) {
                const itemMatch = allItems.find(i => i.code.toUpperCase() === mappedCode.toUpperCase());
                if (itemMatch) return itemMatch;
            }

            const looseMatch = allItems.find(i => i.code.toUpperCase().includes(normHeader) || normHeader.includes(i.code.toUpperCase()));
            if (looseMatch) return looseMatch;

            return null;
        };

        const materialUsagesToCreate = [];

        for (const so of serviceOrders) {
            const row = cleanRows.find(r => {
                const rowSoNum = String(
                    r['SOD'] ||
                    r['SO NUMBER'] ||
                    r['SO_NUM'] ||
                    r['SERVICE ORDER'] ||
                    r['SONUM'] ||
                    ''
                ).trim();
                return rowSoNum.toLowerCase() === so.soNum.toLowerCase();
            });

            if (!row) continue;

            for (const [key, val] of Object.entries(row)) {
                if (isMetadataKey(key)) continue;

                const qty = parseFloat(String(val || '0'));
                if (isNaN(qty) || qty <= 0) continue;

                const item = resolveItemFromHeader(key);
                if (item) {
                    materialUsagesToCreate.push({
                        serviceOrderId: so.id,
                        itemId: item.id,
                        quantity: qty,
                        unit: item.unit || 'Nos',
                        usageType: 'BOM_CLAIM'
                    });
                }
            }
        }

        if (materialUsagesToCreate.length > 0) {
            await prisma.sODMaterialUsage.deleteMany({
                where: { 
                    serviceOrderId: { in: serviceOrders.map(s => s.id) },
                    usageType: 'BOM_CLAIM'
                }
            });

            await prisma.sODMaterialUsage.createMany({
                data: materialUsagesToCreate,
                skipDuplicates: true
            });
        }

        const warnings: string[] = []; // No warnings needed now, as unmatched items are stubbed dynamically.


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

        // 7. Create Client Invoice (SLT Submit Format - ProjectInvoice)
        const totalAmount = invoiceItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        const regionName = serviceOrders[0]?.rtom || 'GLOBAL';
        
        const contractorId = serviceOrders.find(s => s.contractorId)?.contractorId;
        if (!contractorId) {
            throw AppError.badRequest('NO_CONTRACTOR_FOUND_IN_MATCHED_SODS');
        }

        const now = new Date();

        // Look up the active project ID associated with this contractor/BOM
        let projectId: string | null = null;
        let project = await prisma.project.findFirst({
            where: { contractorId },
            orderBy: { createdAt: 'desc' }
        });

        if (!project) {
            project = await prisma.project.findFirst({
                where: {
                    OR: [
                        { name: { contains: 'BOM' } },
                        { name: { contains: 'Invoicing' } },
                        { projectCode: { contains: 'SERV' } }
                    ]
                }
            });
        }

        if (!project) {
            project = await prisma.project.findFirst({
                orderBy: { createdAt: 'desc' }
            });
        }

        if (project) {
            projectId = project.id;
        }

        if (!projectId) {
            throw AppError.badRequest('NO_PROJECT_FOUND_FOR_BILLING');
        }

        // Create Client Invoice (ProjectInvoice table)
        const invoice = await ProjectInvoiceService.createInvoice({
            projectId,
            title: `BOM Client Billing - ${regionName} - ${now.getMonth() + 1}/${now.getFullYear()}`,
            description: `SLT Client Billing generated from BOM sheet. Matches ${serviceOrders.length} connections.`,
            type: 'CLIENT',
            invoiceDate: now,
            referenceNumber: bomPath || null,
            items: invoiceItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                itemType: 'SERVICE'
            }))
        });

        // 6. Update matched ServiceOrders to PAT_PASSED, mark as invoicable, and link to ProjectInvoice
        // Note: Keep invoiced as false so the actual contractor can invoice SLTS for this work.
        await prisma.serviceOrder.updateMany({
            where: { id: { in: matchedIds } },
            data: {
                sltsPatStatus: 'PAT_PASSED',
                hoPatStatus: 'APPROVED',
                isInvoicable: true,
                sltsPatDate: new Date(),
                projectInvoiceId: invoice.id
            }
        });

        return {
            success: true,
            invoicesCreated: 1,
            invoiceId: invoice.id,
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
            throw AppError.badRequest('INVALID_CSV_TEXT');
        }

        const lines = csvText.split(/\r?\n/);
        if (lines.length === 0) {
            throw AppError.badRequest('EMPTY_CSV');
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
