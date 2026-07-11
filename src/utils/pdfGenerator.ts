"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const generateGRNPDF = (grn: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text("SRI LANKA TELECOM SERVICES", 14, 20);
    doc.setFontSize(12);
    doc.text("GOODS RECEIVED NOTE (GRN)", 14, 28);

    // Info Box
    doc.setFontSize(10);
    doc.text(`GRN Number: ${grn.grnNumber}`, 14, 40);
    doc.text(`Date: ${format(new Date(grn.createdAt), 'yyyy-MM-dd HH:mm')}`, 14, 46);
    doc.text(`Store: ${grn.store.name}`, 14, 52);
    doc.text(`Source: ${grn.sourceType === 'SLT' ? 'SLT Head Office' : grn.supplier || 'Local Purchase'}`, 14, 58);
    doc.text(`Received By: ${grn.receivedBy.name}`, 14, 64);

    // Table
    const tableColumn = ["#", "Item Code", "Item Name", "Unit", "Quantity"];
    const tableRows: any[] = [];

    grn.items.forEach((item: any, index: number) => {
        const itemData = [
            index + 1,
            item.item.code,
            item.item.name,
            item.item.unit,
            item.quantity
        ];
        tableRows.push(itemData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 75,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74] }, // Emerald Green
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY || 80;

    doc.text("_______________________", 14, finalY + 30);
    doc.text("Store Keeper Signature", 14, finalY + 36);

    doc.text("_______________________", 140, finalY + 30);
    doc.text("Authorized Officer", 140, finalY + 36);

    // Save
    doc.save(`GRN_${grn.grnNumber}.pdf`);
};

export const generateGatePassPDF = (request: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text("SRI LANKA TELECOM SERVICES", 14, 20);
    doc.setFontSize(14);
    doc.text("GATE PASS / ISSUE NOTE", 14, 28);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Security Check Required", 14, 34);
    doc.setTextColor(0);

    // Info
    doc.text(`Reference No: ${request.id.slice(-8).toUpperCase()}`, 14, 45);
    doc.text(`Date Issued: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 51);
    doc.text(`Issued From: ${request.toStore?.name || 'Main Store'}`, 14, 57);
    doc.text(`Destination: ${request.fromStore?.name || 'Branch Store'}`, 14, 63);
    doc.text(`Transported By: __________________`, 110, 57);
    doc.text(`Vehicle No: __________________`, 110, 63);

    // Table
    const tableColumn = ["#", "Item Code", "Description", "Unit", "Issued Qty"];
    const tableRows: any[] = [];

    request.items.forEach((reqItem: any, index: number) => {
        if (reqItem.approvedQty > 0) {
            tableRows.push([
                index + 1,
                reqItem.item.code,
                reqItem.item.name,
                reqItem.item.unit,
                reqItem.approvedQty
            ]);
        }
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 75,
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY || 80;

    doc.text("_______________________", 14, finalY + 30);
    doc.text("Issued By (Store)", 14, finalY + 36);

    doc.text("_______________________", 80, finalY + 30);
    doc.text("Received By (Transport)", 80, finalY + 36);

    doc.text("_______________________", 150, finalY + 30);
    doc.text("Security Officer", 150, finalY + 36);

    // Save
    doc.save(`GatePass_${request.id.slice(-8)}.pdf`);
};

export const generateDelaySheetPDF = (month: string, rtom: string, orders: any[]) => {
    const doc = new jsPDF('landscape');

    // Header
    doc.setFontSize(16);
    doc.text("SRI LANKA TELECOM SERVICES", 14, 15);
    doc.setFontSize(11);
    doc.text(`MONTH-END SOD DELAY SHEET - ${month}`, 14, 22);
    doc.text(`OPMC / RTOM: ${rtom}`, 14, 28);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 240, 28);
    doc.setTextColor(0);

    // Table
    const tableColumn = ["#", "SO Number", "Voice Number", "RTOM", "Customer Name", "Received Date", "Delay Reasons", "Remarks / Comments"];
    const tableRows: any[] = [];

    orders.forEach((o: any, index: number) => {
        tableRows.push([
            index + 1,
            o.soNum,
            o.voiceNumber,
            o.rtom,
            o.customerName,
            o.receivedDate,
            o.reasons.join(", "),
            o.comments || 'N/A'
        ]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6] }, // Amber Orange
        styles: { fontSize: 8 },
        columnStyles: {
            7: { cellWidth: 70 } // Remarks/Comments column
        }
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY || 40;

    let signY = finalY + 25;
    if (signY + 15 > doc.internal.pageSize.height) {
        doc.addPage();
        signY = 30;
    }

    doc.setFontSize(9);
    doc.text("___________________________", 14, signY);
    doc.text("Prepared By (Contractor)", 14, signY + 6);
    doc.text("Date: ____/____/________", 14, signY + 12);

    doc.text("___________________________", 110, signY);
    doc.text("Checked By (QC Officer / AE)", 110, signY + 6);
    doc.text("Date: ____/____/________", 110, signY + 12);

    doc.text("___________________________", 200, signY);
    doc.text("Approved By (Area Coordinator / Manager)", 200, signY + 6);
    doc.text("Date: ____/____/________", 200, signY + 12);

    // Save
    doc.save(`Delay_Sheet_${month}_${rtom}.pdf`);
};

