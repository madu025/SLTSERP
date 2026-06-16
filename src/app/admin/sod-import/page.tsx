"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    FileSpreadsheet, ArrowRight,
    CheckCircle2, Database, Package, Layout, AlertCircle, Download
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
    materials: Record<string, number>; // Key = itemId
}

interface SystemMaterial {
    id: string;
    name: string;
    code: string | null;
    commonName: string | null;
    source: string | null;
}

const SOD_FIELDS = [
    { key: 'rtom', label: 'RTOM Code', required: true, aliases: ['RTOM', 'AREA'] },
    { key: 'voiceNumber', label: 'Voice Number (TP)', required: true, aliases: ['TP NUMBER', 'VOICE', 'CIRCUIT', 'TEL'] },
    { key: 'orderType', label: 'Order Type', required: false, aliases: ['ORDER TYPE', 'TASK'] },
    { key: 'receivedDate', label: 'Received Date', required: false, aliases: ['RECEIVED DATE', 'SOD RECEIVED'] },
    { key: 'completedDate', label: 'Completed Date', required: false, aliases: ['COMPLETED DATE', 'DONE DATE'] },
    { key: 'package', label: 'Package Name', required: false, aliases: ['PACKAGE', 'FTTH_PACKAGE'] },
    { key: 'contractorName', label: 'Contractor Name', required: false, aliases: ['CONTRACTOR', 'CON NAME'] },
    { key: 'directTeamName', label: 'Direct Team', required: false, aliases: ['DIRECT LABOR', 'TEAM'] },
];

function parseExcelDate(value: unknown): Date | null {
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
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [systemMaterials, setSystemMaterials] = useState<SystemMaterial[]>([]);

    // Reverse Mappings: System Target -> Excel Header
    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}); // fieldKey -> ExcelHeader
    const [matMappings, setMatMappings] = useState<Record<string, string>>({});     // materialId -> ExcelHeader

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

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            setWorkbook(wb);

            const worksheet = wb.Sheets[wb.SheetNames[0]];
            const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

            let headers: string[] = [];
            for (let i = 0; i < Math.min(jsonDataRaw.length, 30); i++) {
                const row = jsonDataRaw[i];
                if (row && row.some(c => {
                    const s = String(c || '').toUpperCase();
                    return s.includes('RTOM') || s.includes('VOICE') || s.includes('TP NUMBER');
                })) {
                    headers = row.map(c => String(c || '').trim()).filter(h => h.length > 0);
                    break;
                }
            }
            const IGNORED_HEADERS = ['S/N', 'INDEX', 'WEB PORTAL TYPE', 'SERIAL NO', 'NO'];
            const filteredHeaders = headers.filter(h =>
                !IGNORED_HEADERS.some(ignored => h.toUpperCase().trim() === ignored) &&
                !IGNORED_HEADERS.some(ignored => h.toUpperCase().includes(ignored) && h.length < 5) // Handle short variations
            );
            setExcelHeaders(filteredHeaders);

            // 1. Try to load saved mappings from localStorage
            const savedFieldsStr = localStorage.getItem('sod_import_persist_fields');
            const savedMatsStr = localStorage.getItem('sod_import_persist_mats');
            const savedFields = savedFieldsStr ? JSON.parse(savedFieldsStr) : {};
            const savedMats = savedMatsStr ? JSON.parse(savedMatsStr) : {};

            // 2. Map Fields (Prioritize Saved persistent mapping, then auto-mapping)
            const fMap: Record<string, string> = {};
            SOD_FIELDS.forEach(f => {
                // If we have a saved mapping AND the header exists in this file, use it
                const savedHeader = savedFields[f.key];
                if (savedHeader && filteredHeaders.includes(savedHeader)) {
                    fMap[f.key] = savedHeader;
                } else {
                    // Fallback to Auto Map
                    const matched = filteredHeaders.find(h =>
                        f.aliases.some(a => h.toUpperCase() === a.toUpperCase()) ||
                        h.toUpperCase().includes(f.key.toUpperCase())
                    );
                    if (matched) fMap[f.key] = matched;
                }
            });

            // 3. Map Materials (Prioritize Saved persistent mapping, then auto-mapping)
            const mMap: Record<string, string> = {};
            systemMaterials.forEach(m => {
                const savedHeader = savedMats[m.id];
                if (savedHeader && filteredHeaders.includes(savedHeader)) {
                    mMap[m.id] = savedHeader;
                } else {
                    const hUpper = m.name.toUpperCase();
                    const matched = filteredHeaders.find(h => {
                        const head = h.toUpperCase();
                        return head === hUpper ||
                            (m.code && head === m.code.toUpperCase()) ||
                            (m.commonName && head === m.commonName.toUpperCase()) ||
                            (m.source === 'SLT' && head === 'F1') ||
                            (m.source === 'COMPANY' && head === 'G1') ||
                            (m.name.includes('Drop Wire') && (head.includes('DROP WIRE') || head.includes('DISTANCE') || head.includes('DW')));
                    });
                    if (matched) mMap[m.id] = matched;
                }
            });

            setFieldMappings(fMap);
            setMatMappings(mMap);
            setStep(2);
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    // Automatically save mappings to localStorage whenever they change
    useEffect(() => {
        if (Object.keys(fieldMappings).length > 0) {
            localStorage.setItem('sod_import_persist_fields', JSON.stringify(fieldMappings));
        }
        if (Object.keys(matMappings).length > 0) {
            localStorage.setItem('sod_import_persist_mats', JSON.stringify(matMappings));
        }
    }, [fieldMappings, matMappings]);

    const [matSearch, setMatSearch] = useState('');

    const filteredMaterials = systemMaterials.filter(m => {
        const query = matSearch.toLowerCase();
        return m.name.toLowerCase().includes(query) ||
            (m.code && m.code.toLowerCase().includes(query)) ||
            (m.source && m.source.toLowerCase().includes(query));
    });

    const confirmMapping = () => {
        if (!workbook) return;
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        let headerIdx = 0;
        for (let i = 0; i < Math.min(jsonDataRaw.length, 30); i++) {
            const rowStr = JSON.stringify(jsonDataRaw[i]).toUpperCase();
            if (rowStr.includes('RTOM') || rowStr.includes('VOICE')) { headerIdx = i; break; }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx }) as Record<string, unknown>[];
        const rows: ParsedRow[] = jsonData.map((row, index) => {
            const parsed: ParsedRow = {
                serialNo: index + 1,
                rtom: String(row[fieldMappings['rtom']] || '').trim(),
                voiceNumber: String(row[fieldMappings['voiceNumber']] || '').trim(),
                orderType: String(row[fieldMappings['orderType']] || 'CREATE').trim(),
                receivedDate: parseExcelDate(row[fieldMappings['receivedDate']]),
                completedDate: parseExcelDate(row[fieldMappings['completedDate']]),
                package: String(row[fieldMappings['package']] || '').trim(),
                dropWireDistance: 0,
                contractorName: String(row[fieldMappings['contractorName']] || '').trim(),
                directTeamName: String(row[fieldMappings['directTeamName']] || '').trim(),
                materials: {}
            };

            // Process Materials
            Object.entries(matMappings).forEach(([matId, header]) => {
                const val = parseFloat(String(row[header] || '0'));
                if (val > 0) {
                    parsed.materials[matId] = (parsed.materials[matId] || 0) + val;

                    // Special Logic: If it's a Drop Wire, set the distance field
                    const matMeta = systemMaterials.find(m => m.id === matId);
                    if (matMeta && matMeta.name.toLowerCase().includes('drop wire')) {
                        parsed.dropWireDistance += val;
                    }
                }
            });

            return parsed;
        }).filter(r => r.rtom || r.voiceNumber);

        setParsedData(rows);
        setStep(3);
    };

    const handleImport = async () => {
        setImporting(true);
        setProgress(0);

        try {
            const res = await fetch('/api/service-orders/import/enqueue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: parsedData })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const jobId = data.jobId;

            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/service-orders/import/enqueue?jobId=${jobId}`);
                    const jobStatus = await statusRes.json();

                    if (jobStatus.state === 'completed') {
                        clearInterval(pollInterval);
                        setImportResults({
                            success: jobStatus.result.successCount,
                            failed: jobStatus.result.errorCount,
                            skippedNoOpmc: jobStatus.result.skippedNoOpmc,
                            errors: []
                        });
                        setImporting(false);
                    } else if (jobStatus.state === 'failed') {
                        clearInterval(pollInterval);
                        setImportResults({
                            success: 0,
                            failed: parsedData.length,
                            skippedNoOpmc: 0,
                            errors: [jobStatus.failedReason || 'Job failed']
                        });
                        setImporting(false);
                    } else {
                        setProgress(Number(jobStatus.progress) || 0);
                    }
                } catch (err) {
                    console.error("Polling error", err);
                }
            }, 2000);

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to start import';
            setImportResults({
                success: 0,
                failed: parsedData.length,
                skippedNoOpmc: 0,
                errors: [message]
            });
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fa]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto space-y-8">

                        <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bulk SOD Import</h1>
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Status: Data Restoration Stage</p>
                            </div>
                            <div className="flex gap-1.5">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={`w-8 h-2 rounded-full transition-all duration-300 ${step >= s ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                ))}
                            </div>
                        </div>

                        {step === 1 && (
                            <Card className="border-0 bg-white shadow-xl rounded-[2.5rem] overflow-hidden">
                                <CardContent className="py-24 text-center">
                                    <div className="relative group cursor-pointer inline-block">
                                        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="absolute inset-0 opacity-0 z-10 cursor-pointer" />
                                        <div className="bg-blue-50 w-32 h-32 rounded-[3.5rem] flex items-center justify-center mx-auto mb-8 border-2 border-blue-100 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-50">
                                            <FileSpreadsheet className="w-14 h-14 text-blue-600" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Upload Legacy File</h2>
                                    <p className="text-slate-400 mt-2 font-medium">Drop your Excel file to start mapping SOD data and Materials.</p>

                                    <div className="mt-8 flex justify-center gap-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                // Generate Template Excel
                                                const headers = [
                                                    'RTOM', 'TP NUMBER', 'ORDER TYPE', 'RECEIVED DATE', 'COMPLETED DATE',
                                                    'PACKAGE', 'CONTRACTOR', 'DIRECT LABOR',
                                                    // Material columns - fetch from systemMaterials
                                                    ...systemMaterials.map(m => m.name)
                                                ];
                                                const ws = XLSX.utils.aoa_to_sheet([headers]);
                                                // Set column widths
                                                ws['!cols'] = headers.map(() => ({ wch: 18 }));
                                                const wb = XLSX.utils.book_new();
                                                XLSX.utils.book_append_sheet(wb, ws, 'SOD_Template');
                                                XLSX.writeFile(wb, 'SOD_Import_Template.xlsx');
                                            }}
                                            className="h-12 px-6 rounded-2xl font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-50"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download Template
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {step === 2 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
                                <Card className="border-0 shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                                    <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
                                        <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-800">
                                            <Layout className="w-5 h-5 text-blue-600" /> SOD Information
                                        </CardTitle>
                                        <CardDescription className="font-bold">Map base SOD fields to Excel headers.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-6">
                                        {SOD_FIELDS.map(f => (
                                            <div key={f.key} className="space-y-2">
                                                <div className="flex justify-between items-center ml-1">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                                                    </span>
                                                    {fieldMappings[f.key] && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">MAPPED</span>
                                                    )}
                                                </div>
                                                <Select value={fieldMappings[f.key] || "none"} onValueChange={(val) => setFieldMappings(p => ({ ...p, [f.key]: val }))}>
                                                    <SelectTrigger className="h-12 bg-white border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm">
                                                        <SelectValue placeholder="-- Skip --" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl shadow-2xl">
                                                        <SelectItem value="none" className="text-slate-400 font-bold italic">-- Skip / IGNORE --</SelectItem>
                                                        {excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <div className="space-y-8">
                                    <Card className="border-0 shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                                        <CardHeader className="bg-purple-50/50 p-8 border-b border-purple-100">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <CardTitle className="text-xl font-black flex items-center gap-3 text-purple-900">
                                                        <Package className="w-5 h-5 text-purple-600" /> Material Assignment
                                                    </CardTitle>
                                                    <CardDescription className="font-bold text-purple-600/60">Map system materials to quantity columns.</CardDescription>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <input
                                                    type="text"
                                                    placeholder="Search materials (F1, G1, Drop Wire...)"
                                                    value={matSearch}
                                                    onChange={(e) => setMatSearch(e.target.value)}
                                                    className="w-full h-10 px-4 rounded-xl bg-white border border-purple-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all shadow-sm"
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-[430px]">
                                                <div className="p-8 space-y-4">
                                                    {filteredMaterials.length === 0 ? (
                                                        <div className="text-center py-10">
                                                            <p className="text-xs font-bold text-slate-400 italic">No materials matching &quot;{matSearch}&quot;</p>
                                                        </div>
                                                    ) : (
                                                        filteredMaterials.map(m => (
                                                            <div key={m.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-purple-300 hover:bg-white transition-all duration-300">
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-black text-slate-700 group-hover:text-purple-700 transition-colors">{m.name}</span>
                                                                            {m.source && (
                                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.source === 'SLT' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                                    {m.source}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-slate-400">{m.code || 'NO_CODE'}</span>
                                                                    </div>
                                                                    {matMappings[m.id] && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />}
                                                                </div>
                                                                <Select value={matMappings[m.id] || "none"} onValueChange={(val) => setMatMappings(p => ({ ...p, [m.id]: val }))}>
                                                                    <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl text-xs font-black text-slate-700">
                                                                        <SelectValue placeholder="Map to Excel column" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl shadow-2xl border-slate-100">
                                                                        <SelectItem value="none" className="text-slate-400 italic font-bold">-- Skip --</SelectItem>
                                                                        {excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    <Button onClick={confirmMapping} className="w-full h-16 rounded-[2rem] bg-gradient-to-r from-blue-600 to-indigo-700 hover:scale-[1.02] active:scale-95 transition-all text-lg font-black shadow-2xl shadow-blue-100">
                                        Review Parsed Data <ArrowRight className="ml-2 w-6 h-6" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <Card className="border-0 shadow-2xl bg-slate-900 rounded-[2.5rem] overflow-hidden text-white">
                                    <CardContent className="p-10 flex justify-between items-center">
                                        <div className="flex gap-16">
                                            <div className="text-center"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Records</p><p className="text-5xl font-black italic tracking-tighter">{parsedData.length}</p></div>
                                            <div className="text-center"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Mapped Items</p><p className="text-5xl font-black italic tracking-tighter text-blue-400">{Object.keys(matMappings).length}</p></div>
                                        </div>
                                        {importing ? (
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-sm font-black italic">PROCESSING BATCHES... {progress}%</span>
                                                <Progress value={progress} className="w-48 h-2 bg-slate-800 rounded-full" />
                                            </div>
                                        ) : importResults ? (
                                            <Button onClick={() => window.location.reload()} className="h-14 px-10 rounded-2xl bg-white text-black font-black">PROCESS COMPLETE</Button>
                                        ) : (
                                            <Button onClick={handleImport} className="h-16 px-12 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 font-black text-xl shadow-2xl shadow-blue-500/20">
                                                START SYNC NOW <CheckCircle2 className="ml-2 w-6 h-6" />
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>

                                {importResults && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white p-8 rounded-[2rem] border-2 border-emerald-50 text-center"><p className="text-emerald-500 text-[10px] font-black uppercase mb-1">Successful</p><p className="text-4xl font-black text-slate-800">{importResults.success}</p></div>
                                        <div className="bg-white p-8 rounded-[2rem] border-2 border-rose-50 text-center"><p className="text-rose-500 text-[10px] font-black uppercase mb-1">Failed</p><p className="text-4xl font-black text-slate-800">{importResults.failed}</p></div>
                                        <div className="bg-white p-8 rounded-[2rem] border-2 border-amber-50 text-center"><p className="text-amber-500 text-[10px] font-black uppercase mb-1">Skipped (No OPMC)</p><p className="text-4xl font-black text-slate-800">{importResults.skippedNoOpmc}</p></div>
                                    </div>
                                )}

                                {!importing && !importResults && (
                                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Database className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-lg font-black text-slate-800">Preview Data Batch</h3>
                                        </div>
                                        <div className="divide-y divide-slate-100 ring-1 ring-slate-100 rounded-[2rem] overflow-hidden">
                                            {parsedData.slice(0, 5).map((r, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white p-6 hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{r.voiceNumber}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 italic">OPMC: {r.rtom}</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        {r.dropWireDistance > 0 && <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black border border-blue-100">DW: {r.dropWireDistance}m</span>}
                                                        {Object.keys(r.materials).length > 0 && <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-lg text-[10px] font-black border border-purple-100">{Object.keys(r.materials).length} ITEMS</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Ready for final database injection. Please review mappings carefully.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
