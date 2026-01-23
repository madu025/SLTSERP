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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Clipboard } from "lucide-react";
import { toast } from "sonner";

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
}

export default function ExcelImportModal({ isOpen, onClose, onImportSuccess }: ExcelImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [pastedData, setPastedData] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);
    const [importMode, setImportMode] = useState<"file" | "paste">("file");

    const processJsonData = (jsonData: any[]) => {
        setPreview(jsonData.slice(0, 10));
    };

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
                    processJsonData(jsonData);
                } catch (err) {
                    console.error("Preview error:", err);
                    toast.error("Failed to read file preview");
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const handlePasteChange = (val: string) => {
        setPastedData(val);
        if (!val.trim()) {
            setPreview([]);
            return;
        }

        try {
            const rows = val.split("\n").filter(r => r.trim());
            if (rows.length === 0) return;

            const headers = rows[0].split("\t").map(h => h.trim());
            const data = rows.slice(1).map(row => {
                const cells = row.split("\t");
                const obj: any = {};
                headers.forEach((h, i) => {
                    obj[h] = cells[i]?.trim() || "";
                });
                return obj;
            });

            processJsonData(data);
        } catch (err) {
            console.error("Paste parse error:", err);
        }
    };

    const handleImport = async () => {
        let finalData: any[] = [];

        if (importMode === "file") {
            if (!file) return;
            setIsUploading(true);
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: "array", cellDates: true });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];

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

                    finalData = XLSX.utils.sheet_to_json(ws, { range: startRow, raw: false, defval: "" });
                    await submitImport(finalData);
                } catch (err) {
                    setIsUploading(false);
                    toast.error("Process failed");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            if (!pastedData.trim()) return;
            setIsUploading(true);
            const rows = pastedData.split("\n").filter(r => r.trim());
            const headers = rows[0].split("\t").map(h => h.trim());
            finalData = rows.slice(1).map(row => {
                const cells = row.split("\t");
                const obj: any = {};
                headers.forEach((h, i) => {
                    obj[h] = cells[i]?.trim() || "";
                });
                return obj;
            });
            await submitImport(finalData);
        }
    };

    const submitImport = async (rows: any[]) => {
        try {
            const response = await fetch("/api/service-orders/bulk-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows }),
            });

            const result = await response.json();

            if (response.ok) {
                toast.success(result.message || "Import successful");
                onImportSuccess();
                onClose();
                setFile(null);
                setPastedData("");
                setPreview([]);
            } else {
                toast.error(result.message || "Import failed");
            }
        } catch (error) {
            toast.error("Import error occurred");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Bulk SOD Import
                    </DialogTitle>
                    <DialogDescription>
                        Import Service Orders by uploading an Excel file or pasting data directly.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="file" value={importMode} onValueChange={(v) => { setImportMode(v as any); setPreview([]); }}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="file" className="flex items-center gap-2">
                            <Upload className="w-3.5 h-3.5" /> Upload File
                        </TabsTrigger>
                        <TabsTrigger value="paste" className="flex items-center gap-2">
                            <Clipboard className="w-3.5 h-3.5" /> Copy & Paste
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="file" className="mt-0">
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
                    </TabsContent>

                    <TabsContent value="paste" className="mt-0">
                        <Textarea
                            placeholder="Copy rows from Excel and paste here (including header row)..."
                            className="min-h-[160px] font-mono text-[11px] bg-slate-50 resize-none border-dashed border-2"
                            value={pastedData}
                            onChange={(e) => handlePasteChange(e.target.value)}
                            disabled={isUploading}
                        />
                        <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 px-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Paste including headers: RTOM, LEA, SOD, CIRCUIT, etc.
                        </div>
                    </TabsContent>
                </Tabs>

                {preview.length > 0 && (
                    <div className="space-y-2 mt-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preview (Top 10 items)</p>
                        <div className="border rounded-lg overflow-hidden">
                            <div className="max-h-[150px] overflow-auto">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="px-2 py-1.5 font-semibold text-slate-600">SOD</th>
                                            <th className="px-2 py-1.5 font-semibold text-slate-600">RTOM</th>
                                            <th className="px-2 py-1.5 font-semibold text-slate-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y bg-white">
                                        {preview.map((row: any, i) => {
                                            const getVal = (row: any, key: string) => {
                                                const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === key.toUpperCase());
                                                return foundKey ? String(row[foundKey]) : "Not Found";
                                            };
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-2 py-1.5 font-mono text-emerald-600 font-medium">{getVal(row, "SOD")}</td>
                                                    <td className="px-2 py-1.5 text-slate-600">{getVal(row, "RTOM")}</td>
                                                    <td className="px-2 py-1.5 text-slate-600 text-[9px] uppercase font-bold">{getVal(row, "STATUS")}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t mt-4">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleImport}
                        disabled={(importMode === "file" ? !file : !pastedData.trim()) || isUploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
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
