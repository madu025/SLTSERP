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
    Package, CheckCircle2, Layout, Table, AlertCircle
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
}

const SYSTEM_FIELDS = [
    { key: 'rtom', label: 'RTOM', required: true, aliases: ['RTOM', 'AREA'] },
    { key: 'voiceNumber', label: 'Voice Number (TP)', required: true, aliases: ['TP NUMBER', 'VOICE', 'CIRCUIT', 'TEL'] },
    { key: 'orderType', label: 'Order Type', required: false, aliases: ['ORDER TYPE', 'TASK', 'SERVICE TYPE'] },
    { key: 'receivedDate', label: 'Received Date', required: false, aliases: ['RECEIVED DATE', 'SOD RECEIVED'] },
    { key: 'completedDate', label: 'Completed Date', required: false, aliases: ['COMPLETED DATE', 'SOD COMPLETE DATE', 'DONE DATE'] },
    { key: 'package', label: 'Package Name', required: false, aliases: ['PACKAGE', 'FTTH_PACKAGE', 'PKG'] },
    { key: 'dropWireDistance', label: 'DW Distance', required: false, aliases: ['DROP WIRE', 'DW', 'DISTANCE', 'LENGTH'] },
    { key: 'contractorName', label: 'Contractor Name', required: false, aliases: ['CONTRACTOR', 'CON NAME', 'CON'] },
    { key: 'directTeamName', label: 'Direct Team', required: false, aliases: ['DIRECT LABOR', 'TEAM', 'STAFF'] },
];

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
    const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview/Import
    const [file, setFile] = useState<File | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [systemMaterials, setSystemMaterials] = useState<SystemMaterial[]>([]);

    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
    const [materialMappings, setMaterialMappings] = useState<Record<string, string>>({});

    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; skippedNoOpmc: number; errors: string[] } | null>(null);

    // Fetch system materials
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

            setExcelHeaders(headers);
            autoMapFields(headers);
            setStep(2);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const autoMapFields = (headers: string[]) => {
        const fields: Record<string, string> = {};
        const mats: Record<string, string> = {};

        SYSTEM_FIELDS.forEach(f => {
            const matched = headers.find(h =>
                f.aliases.some(alias => h.toUpperCase().includes(alias)) ||
                h.toUpperCase() === f.key.toUpperCase()
            );
            if (matched) fields[f.key] = matched;
        });

        headers.forEach(h => {
            const hUpper = h.toUpperCase();
            const matchedMat = systemMaterials.find(m =>
                m.name.toUpperCase() === hUpper ||
                (m.code && m.code.toUpperCase() === hUpper) ||
                m.name.toUpperCase().includes(hUpper)
            );
            if (matchedMat) mats[h] = matchedMat.name;
        });

        setFieldMappings(fields);
        setMaterialMappings(mats);
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

            Object.entries(materialMappings).forEach(([excelHeader, systemMatName]) => {
                const val = Number(row[excelHeader]);
                if (!isNaN(val) && val > 0) {
                    parsed.materials[systemMatName] = (parsed.materials[systemMatName] || 0) + val;
                }
            });
            return parsed;
        }).filter(r => r.rtom || r.voiceNumber);

        setParsedData(rows);
        setStep(3);
        toast.success(`Data parsed successfully: ${rows.length} rows detected.`);
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
        toast.info("Import process completed.");
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto space-y-8">

                        {/* Title Section */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Legacy SOD Import</h1>
                                <p className="text-slate-500 font-medium">Map Excel columns to System Materials and Import History</p>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
                                <div className={`w-3 h-3 rounded-full ${step === 3 ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Step {step} of 3</span>
                            </div>
                        </div>

                        {/* Step 1: Upload */}
                        {step === 1 && (
                            <Card className="border-2 border-dashed border-blue-100 bg-blue-50/10 shadow-xl shadow-blue-50/50">
                                <CardContent className="py-16 text-center">
                                    <div className="relative group cursor-pointer inline-block">
                                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="absolute inset-0 opacity-0 z-10 cursor-pointer" />
                                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 transform group-hover:rotate-6 transition-all shadow-xl shadow-blue-200">
                                            <FileSpreadsheet className="w-12 h-12 text-white" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800">Select Legacy Excel File</h2>
                                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">Upload the spreadsheet containing historical SOD and material consumption data.</p>
                                    <Button variant="outline" className="mt-8 px-8 py-6 rounded-2xl border-2 hover:bg-slate-50">Browse Computer</Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Step 2: Mapping */}
                        {step === 2 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                                {/* Basic Fields */}
                                <Card className="border-0 shadow-2xl shadow-slate-200/50">
                                    <CardHeader className="bg-slate-50/50 border-b p-6">
                                        <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
                                            <Layout className="w-5 h-5 text-blue-500" />
                                            Primary Data Mapping
                                        </CardTitle>
                                        <CardDescription>Match core order information fields from Excel</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-5">
                                        {SYSTEM_FIELDS.map(field => (
                                            <div key={field.key} className="flex flex-col gap-1.5">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">
                                                    {field.label} {field.required && <span className="text-rose-500 text-xs">*</span>}
                                                </Label>
                                                <Select value={fieldMappings[field.key]} onValueChange={(val) => setFieldMappings(p => ({ ...p, [field.key]: val }))}>
                                                    <SelectTrigger className="h-11 border-slate-200 shadow-sm bg-white rounded-xl">
                                                        <SelectValue placeholder="Skip Field" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">-- Skip --</SelectItem>
                                                        {excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                {/* Material Mapping */}
                                <div className="space-y-6">
                                    <Card className="border-0 shadow-2xl shadow-indigo-100 overflow-hidden">
                                        <CardHeader className="bg-indigo-50/50 border-b p-6">
                                            <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                                                <Package className="w-5 h-5 text-indigo-500" />
                                                Material Usage Mapping
                                            </CardTitle>
                                            <CardDescription>Select Excel columns that represent materials</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-[430px]">
                                                <div className="p-6 space-y-4">
                                                    {excelHeaders.filter(h => !Object.values(fieldMappings).includes(h)).map(header => (
                                                        <div key={header} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all flex flex-col gap-3">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[180px]" title={header}>{header}</span>
                                                                {materialMappings[header] && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                            </div>
                                                            <Select value={materialMappings[header] || "none"} onValueChange={(val) => setMaterialMappings(p => ({ ...p, [header]: val }))}>
                                                                <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl text-xs">
                                                                    <SelectValue placeholder="Identify Material" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">-- Not a material --</SelectItem>
                                                                    {systemMaterials.map(m => (
                                                                        <SelectItem key={m.id} value={m.name} className="py-2">
                                                                            <span className="text-[10px] font-bold text-slate-400 mr-2">[{m.code || 'NO-CODE'}]</span>
                                                                            <span className="text-xs font-medium">{m.name}</span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    <Button onClick={confirmMapping} className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-lg font-black shadow-xl shadow-blue-200 hover:scale-[0.99] transition-all">
                                        Confirm Mapping & Preview Data
                                        <ArrowRight className="ml-2 w-6 h-6" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Preview and Progress */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in zoom-in-95 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="bg-white border-0 shadow-lg p-6 flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-3">
                                            <Table className="text-blue-600 w-6 h-6" />
                                        </div>
                                        <p className="text-3xl font-black text-slate-800">{parsedData.length}</p>
                                        <p className="text-xs font-bold uppercase text-slate-400 tracking-widest mt-1">Total Records</p>
                                    </Card>

                                    <Card className="bg-white border-0 shadow-lg p-6 flex flex-col items-center justify-center text-center outline outline-2 outline-emerald-500/20">
                                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3 text-emerald-600">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <p className="text-3xl font-black text-slate-800">{Object.keys(materialMappings).length}</p>
                                        <p className="text-xs font-bold uppercase text-slate-400 tracking-widest mt-1">Material Columns</p>
                                    </Card>

                                    <Button variant="ghost" className="h-full border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-blue-500" onClick={() => setStep(2)}>
                                        <Settings2 className="w-6 h-6 mb-2" />
                                        <span className="text-sm font-bold">Edit Mappings</span>
                                    </Button>
                                </div>

                                {importing && (
                                    <Card className="p-8 border-0 shadow-2xl">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                                    Importing Records...
                                                </h3>
                                                <p className="text-slate-500 text-sm mt-1">Processing batch transactions to database</p>
                                            </div>
                                            <span className="text-4xl font-black text-blue-600 italic">{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-4 bg-slate-100" />
                                    </Card>
                                )}

                                {importResults && (
                                    <Card className="bg-slate-900 text-white border-0 p-8 shadow-2xl">
                                        <div className="grid grid-cols-3 gap-8 text-center border-b border-slate-700 pb-8 mb-8">
                                            <div><p className="text-emerald-400 text-xs font-black uppercase mb-2">SUCCESS</p><p className="text-5xl font-black">{importResults.success}</p></div>
                                            <div><p className="text-rose-400 text-xs font-black uppercase mb-2">FAILED</p><p className="text-5xl font-black">{importResults.failed}</p></div>
                                            <div><p className="text-amber-400 text-xs font-black uppercase mb-2">SKIPPED</p><p className="text-5xl font-black">{importResults.skippedNoOpmc}</p></div>
                                        </div>
                                        {importResults.errors.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 tracking-widest flex items-center gap-2">
                                                    <AlertCircle className="w-3 h-3" /> RECENT ERROR LOGS
                                                </p>
                                                <div className="max-h-32 overflow-y-auto pr-2 space-y-1">
                                                    {importResults.errors.slice(-10).map((err, i) => (
                                                        <p key={i} className="text-[10px] font-mono text-rose-300 opacity-70 truncate">{err}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <Button className="w-full mt-8 bg-white text-slate-900 border-0 py-6 font-bold rounded-2xl" onClick={() => window.location.reload()}>Complete & Finish</Button>
                                    </Card>
                                )}

                                {!importing && !importResults && (
                                    <Button onClick={handleImport} className="w-full h-24 rounded-3xl bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 text-2xl font-black tracking-tighter">
                                        START FINAL IMPORT
                                        <ArrowRight className="ml-4 w-8 h-8" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
