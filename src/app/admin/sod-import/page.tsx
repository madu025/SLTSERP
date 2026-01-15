"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    FileSpreadsheet, ArrowRight, Loader2, Settings2,
    Package, CheckCircle2, Layout, Table, AlertCircle, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRow {
    serialNo: number;
    rtom: string;
    voiceNumber: string;
    orderType: string;
    receivedDate: Date | null;
    completedDate: Date | null;
    package: string;
    dropWireDistance: number;
    contractorName: string;
    directTeamName: string;
    materials: Record<string, number>;
}

interface SystemMaterial {
    id: string;
    name: string;
    code: string | null;
    commonName: string | null;
    source: string | null;
}

const SYSTEM_FIELDS = [
    { key: 'rtom', label: 'RTOM', required: true, aliases: ['RTOM', 'AREA'] },
    { key: 'voiceNumber', label: 'Voice Number (TP)', required: true, aliases: ['TP NUMBER', 'VOICE', 'CIRCUIT', 'TEL'] },
    { key: 'orderType', label: 'Order Type', required: false, aliases: ['ORDER TYPE', 'TASK', 'SERVICE TYPE'] },
    { key: 'receivedDate', label: 'Received Date', required: false, aliases: ['RECEIVED DATE', 'SOD RECEIVED'] },
    { key: 'completedDate', label: 'Completed Date', required: false, aliases: ['COMPLETED DATE', 'SOD COMPLETE DATE', 'DONE DATE'] },
    { key: 'package', label: 'Package Name', required: false, aliases: ['PACKAGE', 'FTTH_PACKAGE', 'PKG'] },
    { key: 'dropWireDistance', label: 'DW Distance', required: false, aliases: ['DROP WIRE', 'DW', 'DISTANCE', 'LENGTH', 'DW DISTANCE'] },
    { key: 'contractorName', label: 'Contractor Name', required: false, aliases: ['CONTRACTOR', 'CON NAME', 'CON'] },
    { key: 'directTeamName', label: 'Direct Team', required: false, aliases: ['DIRECT LABOR', 'TEAM', 'STAFF'] },
];

const IGNORED_ALIASES = ['S/N', 'SERIAL NO', 'WEB PORTAL TYPE', 'INDEX'];

function parseExcelDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }
    return typeof value === 'string' ? new Date(value) : null;
}

export default function SODImportPage() {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [systemMaterials, setSystemMaterials] = useState<SystemMaterial[]>([]);

    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}); // System Field Key -> Excel Header
    const [itemMappings, setItemMappings] = useState<Record<string, string>>({});  // System Item ID -> Excel Header

    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; skippedNoOpmc: number; errors: string[] } | null>(null);

    useEffect(() => {
        fetch('/api/service-orders/import')
            .then(res => res.json())
            .then(data => data.materials && setSystemMaterials(data.materials))
            .catch(err => console.error("Failed to fetch materials", err));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            setWorkbook(wb);

            const worksheet = wb.Sheets[wb.SheetNames[0]];
            const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            let headers: string[] = [];
            for (let i = 0; i < Math.min(jsonDataRaw.length, 30); i++) {
                const row = jsonDataRaw[i];
                if (row && row.some(c => String(c || '').toUpperCase().includes('RTOM') || String(c || '').toUpperCase().includes('VOICE'))) {
                    headers = row.map(c => String(c || '').trim()).filter(h => h.length > 0);
                    break;
                }
            }
            if (headers.length === 0 && jsonDataRaw.length > 0) {
                headers = jsonDataRaw[0].map(c => String(c || '').trim()).filter(h => h.length > 0);
            }

            // Remove ignored headers
            const filteredHeaders = headers.filter(h => !IGNORED_ALIASES.some(alias => h.toUpperCase().includes(alias)));
            setExcelHeaders(filteredHeaders);

            // Auto Map Logic
            const fields: Record<string, string> = {};
            const itemsMap: Record<string, string> = {};

            SYSTEM_FIELDS.forEach(f => {
                const matched = filteredHeaders.find(h =>
                    f.aliases.some(alias => h.toUpperCase() === alias.toUpperCase()) ||
                    h.toUpperCase() === f.key.toUpperCase()
                );
                if (matched) fields[f.key] = matched;
            });

            systemMaterials.forEach(m => {
                const matched = filteredHeaders.find(h => {
                    const hUpper = h.toUpperCase();
                    return hUpper === m.name.toUpperCase() ||
                        (m.code && hUpper === m.code.toUpperCase()) ||
                        (m.commonName && hUpper === m.commonName.toUpperCase()) ||
                        (m.source === 'SLT' && hUpper === 'F1') ||
                        (m.source === 'COMPANY' && hUpper === 'G1');
                });
                if (matched) itemsMap[m.id] = matched;
            });

            setFieldMappings(fields);
            setItemMappings(itemsMap);
            setStep(2);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const confirmMapping = () => {
        if (!workbook) return;
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        let headerIdx = 0;
        for (let i = 0; i < Math.min(jsonDataRaw.length, 30); i++) {
            const rowStr = JSON.stringify(jsonDataRaw[i]).toUpperCase();
            if (rowStr.includes('RTOM') || rowStr.includes('VOICE')) { headerIdx = i; break; }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx }) as any[];
        const rows: ParsedRow[] = jsonData.map((row, index) => {
            const parsed: ParsedRow = {
                serialNo: index + 1,
                rtom: String(row[fieldMappings['rtom']] || '').trim(),
                voiceNumber: String(row[fieldMappings['voiceNumber']] || '').trim(),
                orderType: String(row[fieldMappings['orderType']] || 'CREATE').trim(),
                receivedDate: parseExcelDate(row[fieldMappings['receivedDate']]),
                completedDate: parseExcelDate(row[fieldMappings['completedDate']]),
                package: String(row[fieldMappings['package']] || '').trim(),
                dropWireDistance: parseFloat(String(row[fieldMappings['dropWireDistance']] || '0')) || 0,
                contractorName: String(row[fieldMappings['contractorName']] || '').trim(),
                directTeamName: String(row[fieldMappings['directTeamName']] || '').trim(),
                materials: {}
            };

            // Use itemId as key to ensure uniqueness in backend
            Object.entries(itemMappings).forEach(([itemId, excelHeader]) => {
                const val = Number(row[excelHeader]);
                if (!isNaN(val) && val > 0) {
                    parsed.materials[itemId] = (parsed.materials[itemId] || 0) + val;
                }
            });
            return parsed;
        }).filter(r => r.rtom || r.voiceNumber);

        setParsedData(rows);
        setStep(3);
        toast.success(`Mapping confirmed. ${rows.length} rows ready.`);
    };

    const handleImport = async () => {
        setImporting(true);
        setProgress(0);
        let successCount = 0;
        let failedCount = 0;
        let skippedNoOpmc = 0;
        const errors: string[] = [];

        const BATCH_SIZE = 50;
        for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
            const batch = parsedData.slice(i, i + BATCH_SIZE);
            try {
                const res = await fetch('/api/service-orders/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rows: batch })
                });
                const result = await res.json();
                if (result.success) {
                    successCount += result.summary.success;
                    failedCount += result.summary.failed;
                    skippedNoOpmc += result.summary.skippedNoOpmc || 0;
                    result.results?.forEach((r: any) => !r.success && errors.push(`${r.voiceNumber}: ${r.error}`));
                }
            } catch (err: any) {
                errors.push(`Batch failed: ${err.message}`);
                failedCount += batch.length;
            }
            setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
        }

        setImportResults({ success: successCount, failed: failedCount, skippedNoOpmc, errors });
        setImporting(false);
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto space-y-8">

                        <div className="flex justify-between items-end bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Bulk SOD Import (Legacy)</h1>
                                <p className="text-slate-500 font-medium">Map system materials and SOD headers for data restoration.</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Step</span>
                                <div className="flex gap-1.5">
                                    {[1, 2, 3].map(s => (
                                        <div key={s} className={`w-3 h-3 rounded-full ${step >= s ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {step === 1 && (
                            <Card className="border-2 border-dashed border-blue-100 bg-white shadow-xl shadow-blue-50/20 rounded-3xl overflow-hidden">
                                <CardContent className="py-20 text-center">
                                    <div className="relative group cursor-pointer inline-block">
                                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="absolute inset-0 opacity-0 z-10 cursor-pointer" />
                                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-28 h-28 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-2xl shadow-blue-300">
                                            <FileSpreadsheet className="w-12 h-12 text-white" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800">Drop your legacy Excel here</h2>
                                    <p className="text-slate-400 mt-2 max-w-sm mx-auto font-medium">We'll automatically detect headers and materials to save you time.</p>
                                    <div className="mt-10 flex items-center justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Supports .xlsx</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Detects F1/G1</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {step === 2 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <Card className="border-0 shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                                    <CardHeader className="bg-slate-50/50 p-6 border-b border-slate-100">
                                        <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-800">
                                            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                                                <Layout className="w-5 h-5 text-blue-600" />
                                            </div>
                                            SOD Columns
                                        </CardTitle>
                                        <CardDescription className="font-medium">Map SOD specific fields to Excel headers</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        {SYSTEM_FIELDS.map(field => (
                                            <div key={field.key} className="space-y-1.5">
                                                <div className="flex justify-between items-center ml-1">
                                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                                    </Label>
                                                    {fieldMappings[field.key] && <span className="text-[10px] text-emerald-500 font-bold">Auto-Matched</span>}
                                                </div>
                                                <Select value={fieldMappings[field.key]} onValueChange={(val) => setFieldMappings(p => ({ ...p, [field.key]: val }))}>
                                                    <SelectTrigger className="h-12 border-slate-200 shadow-sm bg-white rounded-2xl font-bold text-slate-700">
                                                        <SelectValue placeholder="-- Ignore this column --" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl border-slate-200 shadow-2xl">
                                                        <SelectItem value="none" className="text-slate-400 font-medium">None / Ignore</SelectItem>
                                                        {excelHeaders.map(h => <SelectItem key={h} value={h} className="font-bold">{h}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <div className="space-y-6">
                                    <Card className="border-0 shadow-2xl shadow-indigo-100/50 rounded-3xl overflow-hidden">
                                        <CardHeader className="bg-indigo-50/30 p-6 border-b border-indigo-50">
                                            <CardTitle className="text-xl font-black flex items-center gap-3 text-indigo-900">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                Material Assignment
                                            </CardTitle>
                                            <CardDescription className="font-medium">Map System Items to Excel columns</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-[460px]">
                                                <div className="p-6 space-y-4">
                                                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3 mb-2">
                                                        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                        <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                                            Select the Excel column that holds the <b>Quantity</b> for each material.
                                                            Ex: "F1" or "Drop Wire Length".
                                                        </p>
                                                    </div>

                                                    {systemMaterials.map(m => (
                                                        <div key={m.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all duration-300 group">
                                                            <div className="flex justify-between items-center mb-3 px-1">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{m.name}</span>
                                                                        {m.source && (
                                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.source === 'SLT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                                {m.source}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-slate-400">{m.code ? `CODE: ${m.code}` : 'SYSTEM ITEM'}</span>
                                                                </div>
                                                                {itemMappings[m.id] && <div className="bg-emerald-500 w-2 h-2 rounded-full shadow-lg shadow-emerald-200" />}
                                                            </div>
                                                            <Select value={itemMappings[m.id] || "none"} onValueChange={(val) => setItemMappings(p => ({ ...p, [m.id]: val }))}>
                                                                <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                                                                    <SelectValue placeholder="Map to column" />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">-- Select Column --</SelectItem>
                                                                    {excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    <Button onClick={confirmMapping} className="w-full h-16 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 text-lg font-black shadow-2xl shadow-blue-200 hover:scale-[0.98] active:scale-95 transition-all">
                                        Confirm Mapping & Preview Data
                                        <ArrowRight className="ml-2 w-6 h-6" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                                        <div className="flex gap-10">
                                            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Records</p><p className="text-4xl font-black italic">{parsedData.length}</p></div>
                                            <div className="w-px bg-slate-700 mx-2" />
                                            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Mapped Items</p><p className="text-4xl font-black italic">{Object.keys(itemMappings).length}</p></div>
                                        </div>
                                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 rounded-2xl font-bold" onClick={() => setStep(2)}>
                                            <Settings2 className="w-5 h-5 mr-2" /> Edit Mappings
                                        </Button>
                                    </div>

                                    <div className="p-10 space-y-8">
                                        {importing && (
                                            <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex flex-col gap-4">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <h3 className="text-2xl font-black text-blue-900 italic">Processing...</h3>
                                                        <p className="text-blue-600 font-bold text-sm">Uploading data batches to cloud server</p>
                                                    </div>
                                                    <span className="text-5xl font-black text-blue-600 italic tracking-tighter">{progress}%</span>
                                                </div>
                                                <Progress value={progress} className="h-4 bg-white rounded-full overflow-hidden" />
                                            </div>
                                        )}

                                        {importResults && (
                                            <Card className="bg-slate-50 border-0 p-8 rounded-3xl">
                                                <div className="grid grid-cols-3 gap-8 text-center bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100">
                                                    <div><p className="text-emerald-500 text-[10px] font-black uppercase mb-1">Success</p><p className="text-4xl font-black text-slate-800">{importResults.success}</p></div>
                                                    <div><p className="text-rose-500 text-[10px] font-black uppercase mb-1">Failed</p><p className="text-4xl font-black text-slate-800">{importResults.failed}</p></div>
                                                    <div><p className="text-amber-500 text-[10px] font-black uppercase mb-1">Skipped</p><p className="text-4xl font-black text-slate-800">{importResults.skippedNoOpmc}</p></div>
                                                </div>
                                                <Button className="w-full mt-10 h-14 bg-slate-900 text-white font-black rounded-2xl shadow-xl" onClick={() => window.location.reload()}>Finish Process</Button>
                                            </Card>
                                        )}

                                        {!importing && !importResults && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4">
                                                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Preview First 5 Rows</h4>
                                                    <div className="space-y-3">
                                                        {parsedData.slice(0, 5).map((r, i) => (
                                                            <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 font-bold text-xs">
                                                                <span className="text-slate-800">{r.voiceNumber}</span>
                                                                <span className="text-slate-400">{r.rtom}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-center gap-6">
                                                    <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
                                                        <p className="text-amber-800 text-xs font-bold flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4" /> Ready for final import.
                                                        </p>
                                                        <p className="text-amber-700 text-[10px] mt-2 font-medium">Please ensure the RTOM codes match the database exactly.</p>
                                                    </div>
                                                    <Button onClick={handleImport} className="h-20 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-3xl shadow-2xl shadow-blue-200">
                                                        START DATA RESTORE
                                                        <ArrowRight className="ml-4 w-8 h-8" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
