import * as XLSX from 'xlsx';

interface SODMaterialUsage {
    item?: {
        name?: string;
    };
    quantity?: number;
}

interface ServiceOrder {
    id: string;
    soNum: string;
    voiceNumber?: string | null;
    techContact?: string | null;
    rtom: string;
    customerName?: string | null;
    address?: string | null;
    lea?: string | null;
    orderType?: string | null;
    serviceType?: string | null;
    receivedDate?: string | null;
    completedDate?: string | null;
    dp?: string | null;
    comments?: string | null;
    dropWireDistance?: number | null;
    materialUsage?: SODMaterialUsage[];
    ontSerialNumber?: string | null;
    iptv?: string | null;
    erectedPoles?: Array<{ poleType: string; poleNumber: string }>;
    iptvSerials?: Array<{ serialNumber: string }>;
}

interface InvoiceDetails {
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: number;
    year?: number | null;
    month?: number | null;
    connectionTitle?: string | null;
    agreementNumber?: string | null;
    projectNumber?: number | null;
    bomNumber?: string | null;
    rtomArea?: string | null;
    contractor?: {
        name?: string;
    };
    items?: Array<{
        quantity: number;
        unitPrice: number;
    }>;
    sods: ServiceOrder[];
}

export async function downloadExcelInvoice(invoiceId: string, invoiceNumber: string) {
    try {
        // 1. Fetch details
        const res = await fetch(`/api/invoices/${invoiceId}/details`);
        if (!res.ok) throw new Error('Failed to fetch invoice details');
        const invoice: InvoiceDetails = await res.json();

        // 2. Fetch correct template xlsm file based on period
        let templateName = 'SLTS-FN-26-AD-FEB-01--ISHAMP INV 2026.xlsm'; // Default (Feb 2026 onwards)
        if (invoice.year === 2025) {
            templateName = 'SLTS-FN-25-HT-JUL-01-ISHAMP INV 2025.xlsm';
        } else if (invoice.year === 2026) {
            if (invoice.month === 1) {
                templateName = 'SLTS-FN-26-AD-JAN-01-ISHAMP INV 2026.xlsm';
            }
        }

        const templateRes = await fetch(`/templates/${templateName}`);
        if (!templateRes.ok) throw new Error(`Failed to load excel template: ${templateName}`);
        const arrayBuffer = await templateRes.arrayBuffer();

        // 3. Parse workbook
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });

        // 4. Update KEY sheet
        const keySheet = wb.Sheets['KEY'];
        if (keySheet) {
            keySheet['C2'] = { v: invoice.connectionTitle || 'FTTH & PeoTV Connections 2026', t: 's' };
            // parse project number as number if possible
            const projNum = invoice.projectNumber || 260103;
            keySheet['C3'] = { v: projNum, t: 'n' };
            keySheet['C4'] = { v: invoice.agreementNumber || 'L/0733/2025', t: 's' };
            keySheet['C5'] = { v: invoice.rtomArea || invoice.sods?.[0]?.rtom || 'ANP', t: 's' };
            keySheet['C6'] = { v: invoice.invoiceNumber || '', t: 's' };
            keySheet['C8'] = { v: invoice.bomNumber || '', t: 's' };
        }

        // 5. Update COVER PAGE sheet
        const coverSheet = wb.Sheets['COVER PAGE'];
        if (coverSheet) {
            coverSheet['H20'] = { v: invoice.rtomArea || invoice.sods?.[0]?.rtom || 'ANP', t: 's' };
            coverSheet['B23'] = { v: invoice.invoiceNumber || '', t: 's' };
        }

        // 6. Update REF DOC sheet
        const refSheet = wb.Sheets['REF DOC'];
        if (refSheet) {
            refSheet['G7'] = { v: invoice.rtomArea || invoice.sods?.[0]?.rtom || 'ANP', t: 's' };
            refSheet['H8'] = { v: invoice.invoiceNumber || '', t: 's' };
            refSheet['H9'] = { v: new Date(invoice.invoiceDate).toLocaleDateString('en-GB'), t: 's' };
            const dateObj = new Date(invoice.invoiceDate);
            const monthName = dateObj.toLocaleString('default', { month: 'short' });
            const year = dateObj.getFullYear();
            refSheet['H10'] = { v: `From: 1-${monthName}-${year}`, t: 's' };
            refSheet['I10'] = { v: `To: 31-${monthName}-${year}`, t: 's' };
        }

        // 7. Update SUMMARY sheet
        const summarySheet = wb.Sheets['SUMMARY'];
        if (summarySheet) {
            const serviceItem = invoice.items?.[0] || { quantity: invoice.sods?.length || 0, unitPrice: 11000 };
            summarySheet['D4'] = { v: invoice.rtomArea || invoice.sods?.[0]?.rtom || 'ANP', t: 's' };
            summarySheet['D6'] = { v: invoice.sods?.length || 0, t: 'n' };
            summarySheet['E9'] = { v: serviceItem.quantity, t: 'n' };
            summarySheet['H9'] = { v: serviceItem.unitPrice, t: 'n' };
        }

        // 8. Update BOM sheet
        const bomSheet = wb.Sheets['BOM'];
        if (bomSheet) {
            // Clear previous data rows from Row 6 (index 5) up to 160
            for (let r = 5; r < 160; r++) {
                for (let c = 1; c < 30; c++) {
                    const cellAddr = XLSX.utils.encode_cell({ r, c });
                    if (bomSheet[cellAddr]) {
                        bomSheet[cellAddr].v = '';
                        bomSheet[cellAddr].t = 's';
                    }
                }
            }

            // Map columns G to AD from row 5
            const colMap: Record<string, number> = {};
            for (let c = 6; c <= 29; c++) {
                const cellAddr = XLSX.utils.encode_cell({ r: 4, c });
                const cell = bomSheet[cellAddr];
                if (cell && cell.v) {
                    const headerName = String(cell.v).toLowerCase().replace(/\s*\(.*\)\s*/g, '').replace(/[^a-z0-9.-]/g, '').trim();
                    colMap[headerName] = c;
                }
            }

            // Populate BOM rows
            invoice.sods.forEach((sod: ServiceOrder, index: number) => {
                const r = 5 + index;

                // A: S/N
                bomSheet[XLSX.utils.encode_cell({ r, c: 0 })] = { v: index + 1, t: 'n' };
                // B: SOD
                bomSheet[XLSX.utils.encode_cell({ r, c: 1 })] = { v: sod.soNum, t: 's' };
                // C: Circuit
                bomSheet[XLSX.utils.encode_cell({ r, c: 2 })] = { v: sod.voiceNumber || sod.techContact || '', t: 's' };
                // D: RTOM
                bomSheet[XLSX.utils.encode_cell({ r, c: 3 })] = { v: sod.rtom || '', t: 's' };
                // E: Contractor
                bomSheet[XLSX.utils.encode_cell({ r, c: 4 })] = { v: invoice.contractor?.name || '', t: 's' };
                // F: Drop Wire
                bomSheet[XLSX.utils.encode_cell({ r, c: 5 })] = { v: sod.dropWireDistance || 0, t: 'n' };

                // Materials
                sod.materialUsage?.forEach((usage: SODMaterialUsage) => {
                    if (usage.item && usage.item.name) {
                        const itemClean = usage.item.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').replace(/[^a-z0-9.-]/g, '').trim();
                        const targetCol = colMap[itemClean];
                        if (targetCol !== undefined) {
                            bomSheet[XLSX.utils.encode_cell({ r, c: targetCol })] = { v: usage.quantity || 0, t: 'n' };
                        }
                    }
                });
            });
        }

        // 9. Update ALLOCATION sheet
        const allocSheet = wb.Sheets['ALLOCATION'];
        if (allocSheet) {
            for (let r = 10; r < 160; r++) {
                for (let c = 1; c < 15; c++) {
                    const cellAddr = XLSX.utils.encode_cell({ r, c });
                    if (allocSheet[cellAddr]) {
                        allocSheet[cellAddr].v = '';
                        allocSheet[cellAddr].t = 's';
                    }
                }
            }

            invoice.sods.forEach((sod: ServiceOrder, index: number) => {
                const r = 10 + index;
                allocSheet[XLSX.utils.encode_cell({ r, c: 0 })] = { v: index + 1, t: 'n' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 1 })] = { v: sod.customerName || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 2 })] = { v: sod.address || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 3 })] = { v: sod.rtom || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 4 })] = { v: sod.lea || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 5 })] = { v: sod.voiceNumber || sod.techContact || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 6 })] = { v: sod.orderType || sod.serviceType || 'FTTH New Connection', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 7 })] = { v: sod.techContact || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 8 })] = { v: sod.iptv || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 9 })] = { v: sod.dp || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 10 })] = { v: sod.iptvSerials?.map(ip => ip.serialNumber).join(', ') || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 11 })] = { v: sod.receivedDate ? new Date(sod.receivedDate).toLocaleDateString('en-GB') : '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 12 })] = { v: sod.completedDate ? new Date(sod.completedDate).toLocaleDateString('en-GB') : '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 13 })] = { v: sod.ontSerialNumber || '', t: 's' };
                allocSheet[XLSX.utils.encode_cell({ r, c: 14 })] = { v: sod.comments || '', t: 's' };
            });
        }

        // 10. Update FDW sheet
        const fdwSheet = wb.Sheets['FDW'];
        if (fdwSheet) {
            for (let r = 3; r < 150; r++) {
                for (let c = 1; c < 3; c++) {
                    const cellAddr = XLSX.utils.encode_cell({ r, c });
                    if (fdwSheet[cellAddr]) {
                        fdwSheet[cellAddr].v = '';
                        fdwSheet[cellAddr].t = 's';
                    }
                }
            }

            invoice.sods.forEach((sod: ServiceOrder, index: number) => {
                const r = 3 + index;
                fdwSheet[XLSX.utils.encode_cell({ r, c: 0 })] = { v: index + 1, t: 'n' };
                fdwSheet[XLSX.utils.encode_cell({ r, c: 1 })] = { v: sod.voiceNumber || sod.techContact || '', t: 's' };
                fdwSheet[XLSX.utils.encode_cell({ r, c: 2 })] = { v: sod.dropWireDistance || 0, t: 'n' };
            });
        }

        // 11. Update POLE SHEET
        const poleSheet = wb.Sheets['POLE SHEET'];
        if (poleSheet) {
            for (let r = 7; r < 150; r++) {
                for (let c = 1; c < 14; c++) {
                    const cellAddr = XLSX.utils.encode_cell({ r, c });
                    if (poleSheet[cellAddr]) {
                        poleSheet[cellAddr].v = '';
                        poleSheet[cellAddr].t = 's';
                    }
                }
            }

            invoice.sods.forEach((sod: ServiceOrder, index: number) => {
                const r = 7 + index;
                poleSheet[XLSX.utils.encode_cell({ r, c: 0 })] = { v: index + 1, t: 'n' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 1 })] = { v: sod.voiceNumber || sod.techContact || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 2 })] = { v: sod.dp || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 3 })] = { v: 0, t: 'n' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 4 })] = { v: sod.lea || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 5 })] = { v: sod.erectedPoles?.[0]?.poleNumber || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 6 })] = { v: sod.erectedPoles?.[1]?.poleNumber || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 7 })] = { v: sod.erectedPoles?.[2]?.poleNumber || '', t: 's' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 8 })] = { v: sod.erectedPoles?.[3]?.poleNumber || '', t: 's' };

                let pole56 = 0;
                let pole67 = 0;
                let pole80 = 0;
                let poleCon = 0;

                sod.materialUsage?.forEach((usage: SODMaterialUsage) => {
                    if (usage.item && usage.item.name) {
                        const name = usage.item.name.toUpperCase();
                        if (name.includes('5.6')) pole56 += (usage.quantity || 0);
                        else if (name.includes('6.7')) pole67 += (usage.quantity || 0);
                        else if (name.includes('8.0') || name.includes('8.M') || name.includes('8M') || name === 'PLC-8') pole80 += (usage.quantity || 0);
                        else if (name.includes('CON')) poleCon += (usage.quantity || 0);
                    }
                });

                poleSheet[XLSX.utils.encode_cell({ r, c: 9 })] = { v: pole56, t: 'n' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 10 })] = { v: pole67, t: 'n' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 11 })] = { v: pole80, t: 'n' };
                poleSheet[XLSX.utils.encode_cell({ r, c: 12 })] = { v: poleCon, t: 'n' };
            });
        }

        // 12. Write and save as clean xlsx (stripping VBA macros)
        const wbout = XLSX.write(wb, { bookType: 'xlsx', bookSST: false, type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Clean filename to match expected naming convention
        const cleanInvNum = invoiceNumber.trim().replace(/[\/\\?%*:|"<>\s]/g, '-');
        const filename = `${cleanInvNum}.xlsx`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (err) {
        console.error('Error generating excel:', err);
        const error = err as Error;
        alert('Failed to generate Excel invoice: ' + error.message);
    }
}
