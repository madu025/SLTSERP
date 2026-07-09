import { prisma } from '@/lib/prisma';
import { InvoiceCalculatorService } from '../invoice/invoice.calculator.service';
import { InvoiceGeneratorService } from '../invoice/invoice.generator.service';

export class BOMInvoiceService {
    /**
     * Parse Excel row data and generate Invoice & PaymentVoucher summaries without raw BOM saving
     */
    static async processBOMImport(rows: Record<string, unknown>[], userId: string) {
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

        // 2. Map rows to structured data
        const structuredRows = rows.map((row, idx) => {
            // Flex mapping for contractor name
            const contractorName = String(
                row['Contractor'] ||
                row['CON_NAME'] ||
                row['Contractor Name'] ||
                row['Vendor'] ||
                row['contractor'] ||
                ''
            ).trim();

            // Flex mapping for amount
            const amountStr = String(
                row['Amount'] ||
                row['Cost'] ||
                row['Total'] ||
                row['Rate'] ||
                row['Price'] ||
                row['Value'] ||
                row['amount'] ||
                '0'
            ).trim();
            const amount = parseFloat(amountStr) || 0;

            // Flex mapping for invoice number
            const invoiceNumber = String(
                row['Invoice Number'] ||
                row['Invoice_Num'] ||
                row['InvoiceNumber'] ||
                row['Invoice Ref'] ||
                row['invoiceNumber'] ||
                ''
            ).trim();

            // Flex mapping for dates/month/year
            const monthStr = String(row['Month'] || row['month'] || '').trim();
            const yearStr = String(row['Year'] || row['year'] || '').trim();
            
            let month = parseInt(monthStr);
            let year = parseInt(yearStr);
            
            if (isNaN(month) || month < 1 || month > 12) {
                month = new Date().getMonth() + 1;
            }
            if (isNaN(year) || year < 2000) {
                year = new Date().getFullYear();
            }

            return {
                contractorName,
                amount,
                invoiceNumber,
                month,
                year,
                originalRowIndex: idx + 1
            };
        });

        // Filter out empty rows or zero amounts
        const validRows = structuredRows.filter(r => r.contractorName && r.amount > 0);
        if (validRows.length === 0) {
            throw new Error('NO_VALID_DATA_FOUND');
        }

        // Group rows by Contractor name and Invoice Number
        // Key: `${contractorName}::${invoiceNumber}::${year}::${month}`
        const groups: Record<string, typeof validRows> = {};
        for (const r of validRows) {
            const key = `${r.contractorName.toLowerCase()}::${r.invoiceNumber.toLowerCase()}::${r.year}::${r.month}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(r);
        }

        let invoicesCreated = 0;
        let pvsCreated = 0;
        const warnings: string[] = [];

        // Process groups inside database transaction
        await prisma.$transaction(async (tx) => {
            for (const key in groups) {
                const groupRows = groups[key];
                const firstRow = groupRows[0];
                const contractorSearchName = firstRow.contractorName;

                // Match contractor in database case-insensitively
                const contractor = await tx.contractor.findFirst({
                    where: {
                        name: {
                            contains: contractorSearchName,
                            mode: 'insensitive'
                        }
                    }
                });

                if (!contractor) {
                    warnings.push(`Contractor "${contractorSearchName}" not found in system. Skipping.`);
                    continue;
                }

                const totalAmount = groupRows.reduce((sum, r) => sum + r.amount, 0);
                const { amountA, amountB } = InvoiceCalculatorService.calculateSplit(totalAmount, 0);

                // Determine invoice number
                let finalInvoiceNum = firstRow.invoiceNumber;
                if (!finalInvoiceNum) {
                    const prefix = InvoiceCalculatorService.getContractorPrefix(contractor.name);
                    finalInvoiceNum = await InvoiceGeneratorService.generateUniqueNumber(
                        prefix,
                        'METRO',
                        firstRow.year,
                        firstRow.month
                    );
                }

                // Check if invoice number already exists
                const existingInvoice = await tx.invoice.findUnique({
                    where: { invoiceNumber: finalInvoiceNum }
                });
                if (existingInvoice) {
                    warnings.push(`Invoice number "${finalInvoiceNum}" already exists. Skipping.`);
                    continue;
                }

                // Create monthly Contractor Invoice
                const invoice = await tx.invoice.create({
                    data: {
                        invoiceNumber: finalInvoiceNum,
                        contractorId: contractor.id,
                        projectId: defaultProject.id,
                        year: firstRow.year,
                        month: firstRow.month,
                        totalAmount: totalAmount,
                        amount: totalAmount,
                        amountA,
                        amountB,
                        status: 'PENDING',
                        statusA: 'PENDING',
                        statusB: 'HOLD',
                        description: `BOM Import Invoice - ${firstRow.month}/${firstRow.year}`
                    }
                });

                invoicesCreated++;

                // Create linked Payment Voucher
                // Generate a unique PV Number
                const countPV = await tx.paymentVoucher.count({
                    where: { pvNumber: { startsWith: `PV-${new Date().getFullYear()}-` } }
                });
                const nextPVSeq = String(countPV + 1).padStart(4, '0');
                const pvNumber = `PV-${new Date().getFullYear()}-${nextPVSeq}`;

                await tx.paymentVoucher.create({
                    data: {
                        pvNumber,
                        projectId: defaultProject.id,
                        title: `BOM Payout - ${finalInvoiceNum}`,
                        description: `BOM_INVOICING_REF:${invoice.id}`,
                        amount: totalAmount,
                        netAmount: totalAmount,
                        type: 'CONTRACTOR',
                        payeeName: contractor.name,
                        payeeId: contractor.id,
                        createdById: userId,
                        status: 'DRAFT'
                    }
                });

                pvsCreated++;
            }
        });

        return {
            success: true,
            invoicesCreated,
            pvsCreated,
            warnings
        };
    }
}
