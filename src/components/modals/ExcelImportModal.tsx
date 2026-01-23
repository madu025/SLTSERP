"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
}

export default function ExcelImportModal({ isOpen, onClose, onImportSuccess }: ExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: "array", cellDates: true });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];

                    // Smart Header Detection: Find the row that actually contains our headers
                    let startRow = 0;
                    const ref = ws['!ref'];
                    if (ref) {
                        const decoded = XLSX.utils.decode_range(ref);
                        for (let r = 0; r < Math.min(decoded.e.r, 20); r++) {
                            let isHeaderRow = false;
                            for (let c = 0; c <= decoded.e.c; c++) {
                                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                                if (cell && cell.v) {
                                    const val = String(cell.v).toUpperCase().trim();
                                    if (['SOD', 'RTOM', 'SERVICE', 'TASK', 'STATUS'].includes(val)) {
                                        isHeaderRow = true;
                                        break;
                                    }
                                }
                            }
                            if (isHeaderRow) {
                                startRow = r;
                                break;
                            }
                        }
                    }

                    const jsonData = XLSX.utils.sheet_to_json(ws, { range: startRow, raw: false, defval: "" });
                    setPreview(jsonData.slice(0, 10));
                } catch (err) {
                    console.error("Preview error:", err);
                    toast.error("Failed to read file preview");
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: "array", cellDates: true });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];

                    // Smart Header Detection
                    let startRow = 0;
                    const ref = ws['!ref'];
                    if (ref) {
                        const decoded = XLSX.utils.decode_range(ref);
                        for (let r = 0; r < Math.min(decoded.e.r, 20); r++) {
                            let isHeaderRow = false;
                            for (let c = 0; c <= decoded.e.c; c++) {
                                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                                if (cell && cell.v) {
                                    const val = String(cell.v).toUpperCase().trim();
                                    if (['SOD', 'RTOM', 'SERVICE', 'TASK', 'STATUS'].includes(val)) {
                                        isHeaderRow = true;
                                        break;
                                    }
                                }
                            }
                            if (isHeaderRow) {
                                startRow = r;
                                break;
                            }
                        }
                    }

                    const jsonData = XLSX.utils.sheet_to_json(ws, { range: startRow, raw: false, defval: "" });

                    const response = await fetch("/api/service-orders/bulk-import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rows: jsonData }),
                    });

                    const result = await response.json();

                    if (response.ok) {
                        toast.success(result.message || "Import successful");
                        onImportSuccess();
                        onClose();
                        setFile(null);
                        setPreview([]);
                    } else {
                        toast.error(result.message || "Import failed");
                    }
                } catch (err) {
                    console.error("Import error:", err);
                    toast.error("Failed to process file");
                    setIsUploading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Import error:", error);
            toast.error("An error occurred during import");
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Import SODs from Excel
                    </DialogTitle>
                    <DialogDescription>
                        Upload an Excel file exported from SLT Portal. The system will automatically map the columns.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-900">
                                {file ? file.name : "Click or drag to upload Excel"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, .csv</p>
                        </div>
                    </div>

                    {preview.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preview (Top 5 rows)</p>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-2 py-1 font-semibold">SOD</th>
                                            <th className="px-2 py-1 font-semibold">RTOM</th>
                                            <th className="px-2 py-1 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {preview.map((row: any, i) => {
                                            const getVal = (row: any, key: string) => {
                                                const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === key.toUpperCase());
                                                return foundKey ? String(row[foundKey]) : "Not Found";
                                            };
                                            return (
                                                <tr key={i}>
                                                    <td className="px-2 py-1 font-mono text-emerald-600">{getVal(row, "SOD")}</td>
                                                    <td className="px-2 py-1">{getVal(row, "RTOM")}</td>
                                                    <td className="px-2 py-1">{getVal(row, "STATUS")}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!file && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 text-blue-700">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed">
                                <p className="font-bold">Required Columns:</p>
                                <p>RTOM, LEA, SOD, CIRCUIT, SERVICE, ORDER TYPE, TASK, RECEIVED ON, PACKAGE, STATUS, ADDRESS, etc.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleImport}
                        disabled={!file || isUploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Check className="w-3 h-3 mr-2" />
                                Start Import
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
