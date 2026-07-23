import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SODInvoicingService } from '@/services/sod/sod.invoicing.service';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        // 1. Fetch Invoice with Contractor, Project, Penalties, and Linked Service Orders
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        registrationNumber: true,
                        address: true,
                        contactNumber: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true,
                        brNumber: true
                    }
                },
                project: { select: { id: true, name: true, projectCode: true } },
                penalties: true,
                sods: {
                    include: {
                        erectedPoles: true,
                        materialUsage: {
                            include: {
                                item: { select: { id: true, code: true, name: true, unit: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // 2. Calculate Monthly Material Balance Sheet for Contractor
        const invDate = new Date(invoice.createdAt || invoice.date);
        const monthStr = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;

        // Fetch Contractor Stock & Items
        const contractorStocks = await prisma.contractorStock.findMany({
            where: { contractorId: invoice.contractorId },
            include: { item: true }
        });

        // Fetch Issues for the month
        const materialIssues = await prisma.contractorMaterialIssueItem.findMany({
            where: {
                issue: {
                    contractorId: invoice.contractorId,
                    month: monthStr
                }
            },
            include: { item: true }
        });

        // Map Balance Sheet
        const itemMap = new Map<string, {
            itemId: string;
            code: string;
            name: string;
            unit: string;
            issuedQty: number;
            consumedQty: number;
            wastageQty: number;
            returnedQty: number;
            closingBalance: number;
            openingBalance: number;
        }>();

        // Register items from contractor stock
        for (const cs of contractorStocks) {
            itemMap.set(cs.itemId, {
                itemId: cs.itemId,
                code: cs.item.code,
                name: cs.item.name,
                unit: cs.item.unit,
                issuedQty: 0,
                consumedQty: 0,
                wastageQty: 0,
                returnedQty: 0,
                closingBalance: parseFloat(cs.quantity.toString()),
                openingBalance: 0
            });
        }

        // Add issued quantities
        for (const mi of materialIssues) {
            let entry = itemMap.get(mi.itemId);
            if (!entry) {
                entry = {
                    itemId: mi.itemId,
                    code: mi.item.code,
                    name: mi.item.name,
                    unit: mi.item.unit,
                    issuedQty: 0,
                    consumedQty: 0,
                    wastageQty: 0,
                    returnedQty: 0,
                    closingBalance: 0,
                    openingBalance: 0
                };
                itemMap.set(mi.itemId, entry);
            }
            entry.issuedQty += parseFloat(mi.quantity.toString());
        }

        // Aggregate SOD Consumptions and Wastages
        for (const sodItem of invoice.sods) {
            for (const mu of sodItem.materialUsage) {
                if (!mu.item) continue;
                let entry = itemMap.get(mu.itemId);
                if (!entry) {
                    entry = {
                        itemId: mu.itemId,
                        code: mu.item.code,
                        name: mu.item.name,
                        unit: mu.item.unit,
                        issuedQty: 0,
                        consumedQty: 0,
                        wastageQty: 0,
                        returnedQty: 0,
                        closingBalance: 0,
                        openingBalance: 0
                    };
                    itemMap.set(mu.itemId, entry);
                }
                const qty = parseFloat(mu.quantity.toString());
                if (mu.usageType === 'WASTAGE') {
                    entry.wastageQty += qty;
                } else if (['USED', 'USED_F1', 'USED_G1'].includes(mu.usageType)) {
                    entry.consumedQty += qty;
                } else if (mu.usageType === 'RETURNED') {
                    entry.returnedQty += qty;
                }
            }
        }

        // Compute Opening Balances: Closing = Opening + Issued - Consumed - Wastage + Returned
        const balanceSheet = Array.from(itemMap.values()).map((entry) => {
            const calculatedOpening = entry.closingBalance - entry.issuedQty + entry.consumedQty + entry.wastageQty - entry.returnedQty;
            entry.openingBalance = Math.max(0, calculatedOpening);
            return entry;
        });

        // 3. Compute Itemized Work Items for Invoice Page 1 Table
        const itemMapGroup = new Map<string, { description: string; rtom: string; qty: number; unitRate: number; amount: number }>();

        // Helper to ensure RTOM always has R- prefix
        const formatRtomWithPrefix = (rtomStr?: string | null) => {
            if (!rtomStr) return 'R-GP';
            const trimmed = rtomStr.trim().toUpperCase();
            return trimmed.startsWith('R-') ? trimmed : `R-${trimmed}`;
        };

        for (const sod of invoice.sods) {
            const formattedRtom = formatRtomWithPrefix(sod.rtom);
            const dwUsage = sod.materialUsage.find(m => {
                const itemCode = (m.item?.code || '').toUpperCase();
                const itemName = (m.item?.name || '').toUpperCase();
                const usageType = (m.usageType || '').toUpperCase();
                const isRetainer = itemName.includes('RETAINER') || itemCode.includes('RETNER') || itemName.includes('CLAMP');
                return !isRetainer && (usageType === 'PORTAL_SYNC' || usageType === 'USED_F1' || itemCode === 'OSP-HC-CBL-DW' || itemName.includes('DROP CABLE') || itemName.includes('DROP WIRE'));
            });
            const actualDwLength = dwUsage ? parseFloat(dwUsage.quantity.toString()) : 150;
            const calc = await SODInvoicingService.calculateAmounts(sod.rtom, actualDwLength, { serviceType: sod.serviceType });
            const workDesc = calc.workDescription || `${sod.serviceType || 'FTTH'} - DW length- (${actualDwLength}m)`;
            const rate = calc.contractorAmount || 7800;
            const key = `${workDesc}_${formattedRtom}_${rate}`;

            const existing = itemMapGroup.get(key);
            if (existing) {
                existing.qty += 1;
                existing.amount += rate;
            } else {
                itemMapGroup.set(key, {
                    description: workDesc,
                    rtom: formattedRtom,
                    qty: 1,
                    unitRate: rate,
                    amount: rate
                });
            }
        }

        const workItems: Array<{ sn: number; description: string; rtom: string; qty: number; unitRate: number; amount: number }> = [];
        let snCounter = 1;
        for (const val of itemMapGroup.values()) {
            workItems.push({
                sn: snCounter++,
                description: val.description,
                rtom: val.rtom,
                qty: val.qty,
                unitRate: val.unitRate,
                amount: val.amount
            });
        }

        // 4. Fetch active Payment Split Rule configuration set by SF Auditors
        const splitConfigRow = await prisma.systemConfig.findUnique({
            where: { key: 'SF_AUDIT_PAYMENT_SPLIT_CONFIG' }
        });

        let splitConfig = {
            splitMode: 'SPLIT_AB' as 'SINGLE_FULL' | 'SPLIT_AB' | 'SPLIT_ABC',
            claimAPercent: 90,
            claimBPercent: 10,
            claimCPercent: 0
        };

        if (splitConfigRow) {
            try {
                const parsed = JSON.parse(splitConfigRow.value);
                splitConfig = { ...splitConfig, ...parsed };
            } catch {
                // Fallback to default
            }
        }

        const totalGrossAmount = parseFloat(invoice.totalAmount.toString());

        // Calculate dynamic Claim A, B, and C amounts based on DB Config
        let calcAmountA = parseFloat(invoice.amountA.toString());
        let calcAmountB = parseFloat(invoice.amountB.toString());
        let calcAmountC = 0;

        if (splitConfig.splitMode === 'SINGLE_FULL') {
            calcAmountA = totalGrossAmount;
            calcAmountB = 0;
            calcAmountC = 0;
        } else {
            calcAmountA = Math.round((totalGrossAmount * splitConfig.claimAPercent) / 100);
            calcAmountB = Math.round((totalGrossAmount * splitConfig.claimBPercent) / 100);
            calcAmountC = Math.round((totalGrossAmount * splitConfig.claimCPercent) / 100);
        }

        // 5. Structure Final Public Payload
        const responseData = {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.createdAt || invoice.date,
            agreementNumber: invoice.agreementNumber || 'L/0733/2025',
            projectNumber: invoice.projectNumber || 260103,
            bomNumber: invoice.bomNumber || `BOM-${invoice.invoiceNumber}`,
            rtomArea: invoice.rtomArea || 'METRO',
            connectionTitle: invoice.connectionTitle || 'FTTH NEW CONNECTIONS',
            totalAmount: totalGrossAmount,
            amountA: calcAmountA,
            amountB: calcAmountB,
            amountC: calcAmountC,
            splitConfig,
            status: invoice.status,
            statusA: invoice.statusA,
            statusB: invoice.statusB,
            paidDateA: invoice.paidDateA,
            paidDateB: invoice.paidDateB,
            contractor: invoice.contractor,
            project: invoice.project,
            workItems,
            penalties: invoice.penalties.map((p) => ({
                id: p.id,
                amount: parseFloat(p.amount.toString()),
                reason: p.reason,
                status: p.status
            })),
            sods: invoice.sods.map((is) => ({
                serviceOrderId: is.id,
                soNum: is.soNum,
                rtom: is.rtom,
                serviceType: is.serviceType,
                voiceNumber: is.voiceNumber,
                circuitNumber: (is as Record<string, unknown>).circuitNumber as string | undefined || is.voiceNumber || is.soNum,
                package: is.package,
                comments: is.comments,
                directTeam: is.directTeam,
                completedAt: is.completedDate,
                erectedPoles: is.erectedPoles || [],
                materialUsage: is.materialUsage.map((mu) => ({
                    itemId: mu.itemId,
                    quantity: parseFloat(mu.quantity.toString()),
                    usageType: mu.usageType,
                    item: mu.item
                }))
            })),
            balanceSheet
        };

        return NextResponse.json({ success: true, data: responseData });
    } catch (error: unknown) {
        console.error('[PUBLIC_INVOICE_API_ERROR]', error);
        const details = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to fetch public invoice details', details }, { status: 500 });
    }
}
