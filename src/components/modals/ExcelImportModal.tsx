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
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Clipboard, XCircle, AlertTriangle } from "lucide-react";
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
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [stats, setStats] = useState<{ created: number; failed: number } | null>(null);

    const processJsonData = (jsonData: any[]) => {
        setPreview(jsonData.slice(0, 15)); // Show a bit more for preview
        setImportErrors([]);
        setStats(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setImportErrors([]);
            setStats(null);

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
                    toast.error("Failed to read file preview");
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const handlePasteChange = (val: string) => {
        setPastedData(val);
        setImportErrors([]);
        setStats(null);
        if (!val.trim()) {
            setPreview([]);
            return;
        }

        try {
            const rows = val.split("\n").filter(r => r.trim());
            if (rows.length === 0) return;

            const delimiter = val.includes("\t") ? "\t" : val.includes(",") ? "," : null;
            if (!delimiter) return;

            const headers = rows[0].split(delimiter).map(h => h.trim());
            const data = rows.slice(1).map(row => {
                const cells = row.split(delimiter);
                const obj: any = {};
                headers.forEach((h, i) => {
                    if (h) obj[h] = cells[i]?.trim() || "";
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
        setImportErrors([]);
        setStats(null);

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
            const delimiter = pastedData.includes("\t") ? "\t" : ",";
            const headers = rows[0].split(delimiter).map(h => h.trim());
            finalData = rows.slice(1).map(row => {
                const cells = row.split(delimiter);
                const obj: any = {};
                headers.forEach((h, i) => {
                    if (h) obj[h] = cells[i]?.trim() || "";
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
                setStats({ created: result.created, failed: result.failed });
                if (result.errors && result.errors.length > 0) {
                    setImportErrors(result.errors);
                    toast.warning(`Imported ${result.created} but ${result.failed} failed.`);
                } else {
                    toast.success(result.message || "Import successful");
                    onImportSuccess();
                    onClose();
                }
            } else {
                toast.error(result.message || "Import failed");
            }
        } catch (error) {
            toast.error("Import error occurred");
        } finally {
            setIsUploading(false);
        }
    };

    const getVal = (row: any, key: string) => {
        const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === key.toUpperCase());
        return foundKey ? String(row[foundKey]) : null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Bulk SOD Import
                    </DialogTitle>
                    <DialogDescription>
                        Import Service Orders by uploading an Excel file or pasting data directly.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="file" value={importMode} onValueChange={(v) => { setImportMode(v as any); setPreview([]); setImportErrors([]); setStats(null); }}>
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
                            className="min-h-[140px] font-mono text-[11px] bg-slate-50 resize-none border-dashed border-2"
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

                {importErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 mt-4">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-[11px] mb-2">
                            <XCircle className="w-3.5 h-3.5" />
                            Import Errors ({stats?.failed} failed)
                        </div>
                        <ul className="space-y-1">
                            {importErrors.map((err, idx) => (
                                <li key={idx} className="text-[10px] text-red-600 flex items-start gap-1.5 leading-tight">
                                    <span className="shrink-0">•</span> {err}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {preview.length > 0 && (
                    <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preview Validation (Top 15)</p>
                            <div className="flex gap-3 text-[10px]">
                                {preview.some(r => !getVal(r, 'SOD')) && (
                                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                                        <AlertTriangle className="w-3 h-3" /> Missing SODs
                                    </span>
                                )}
                                {preview.some(r => !getVal(r, 'RTOM')) && (
                                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                                        <AlertTriangle className="w-3 h-3" /> Missing RTOMs
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="border rounded-lg overflow-hidden shadow-sm">
                            <div className="max-h-[180px] overflow-auto">
                                <table className="w-full text-[10px] text-left border-collapse min-w-full">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {Object.keys(preview[0]).map((key) => (
                                                <th key={key} className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap border-r last:border-0 bg-slate-50">
                                                    {key.toUpperCase()}
                                                </th>
                                            ))}
                                            <th className="px-3 py-2 font-bold text-emerald-700 whitespace-nowrap bg-emerald-50/50">
                                                SUGGESTED ACTION
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y bg-white">
                                        {preview.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                                {Object.keys(preview[0]).map((key) => {
                                                    const val = row[key];
                                                    const isSod = key.toUpperCase().trim() === 'SOD';
                                                    const isRtom = key.toUpperCase().trim() === 'RTOM';
                                                    const isMissing = !val && (isSod || isRtom);

                                                    return (
                                                        <td key={key} className={`px-3 py-1.5 whitespace-nowrap border-r last:border-0 ${isSod ? 'font-mono text-emerald-600 font-medium' : 'text-slate-600'} ${isMissing ? 'bg-red-50 text-red-500 italic' : ''}`}>
                                                            {val || (isMissing ? "MISSING" : "-")}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-1.5 whitespace-nowrap bg-emerald-50/30">
                                                    {(() => {
                                                        const s = String(getVal(row, 'STATUS') || "").toUpperCase();
                                                        if (s === 'INSTALL_CLOSED' || s === 'COMPLETED')
                                                            return <span className="text-[9px] font-bold text-emerald-600 px-1.5 py-0.5 rounded-full bg-emerald-100/50 border border-emerald-200">MARK AS COMPLETED</span>;
                                                        if (s === 'PROV_CLOSED' || s === 'INPROGRESS' || s === 'ASSIGNED')
                                                            return <span className="text-[9px] font-bold text-blue-600 px-1.5 py-0.5 rounded-full bg-blue-100/50 border border-blue-200">MARK AS INPROGRESS</span>;
                                                        if (s.includes('RETURN'))
                                                            return <span className="text-[9px] font-bold text-red-600 px-1.5 py-0.5 rounded-full bg-red-100/50 border border-red-200">MARK AS RETURN</span>;
                                                        return <span className="text-[9px] font-bold text-slate-500">PENDING</span>;
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 italic font-medium px-1">* Scroll horizontally to see all columns</p>
                    </div>
                )}

                <div className="flex gap-2 justify-end pt-3 border-t mt-4">
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
