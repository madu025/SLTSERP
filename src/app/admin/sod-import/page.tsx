"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { FileSpreadsheet, ArrowRight, Loader2, Settings2, Package, CheckCircle2 } from 'lucide-react';
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
    const [file, setFile] = useState<File | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
    const [systemMaterials, setSystemMaterials] = useState<SystemMaterial[]>([]);

    // Mappings
    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
    const [materialMappings, setMaterialMappings] = useState<Record<string, string>>({}); // Excel Header -> System Material Name

    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [isMappingConfirmed, setIsMappingConfirmed] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; skippedNoOpmc: number; errors: string[] } | null>(null);
    const [skipMaterials, setSkipMaterials] = useState(false);

    // Fetch material names from system
    useEffect(() => {
        const fetchMaterials = async () => {
            try {
                const res = await fetch('/api/service-orders/import'); // Using the helper GET in route.ts
                const data = await res.json();
                if (data.materials) setSystemMaterials(data.materials);
            } catch (err) {
                console.error("Failed to fetch materials", err);
            }
        };
        fetchMaterials();
    }, []);

    // 1. Handle File Selection
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsMappingConfirmed(false);
        setParsedData([]);
        setImportResults(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            setWorkbook(wb);

            const worksheet = wb.Sheets[wb.SheetNames[0]];
            const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];

            // Find header row
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

            setDetectedHeaders(headers);

            // Auto-mapping Primary Fields
            const initialFieldMappings: Record<string, string> = {};
            SYSTEM_FIELDS.forEach(field => {
                const found = headers.find(h =>
                    field.aliases.some(alias => h.toUpperCase().includes(alias)) ||
                    h.toUpperCase() === field.key.toUpperCase()
                );
                if (found) initialFieldMappings[field.key] = found;
            });
            setFieldMappings(initialFieldMappings);

            // Auto-mapping Materials
            const initialMatMappings: Record<string, string> = {};
            headers.forEach(h => {
                const hUpper = h.toUpperCase().trim();

                // Specific Check for DW-RT (Retainer)
                if (hUpper === 'DW-RT' || hUpper.includes('RETAINER')) {
                    const retainerMat = systemMaterials.find(m => m.name.toUpperCase().includes('RETAINER'));
                    if (retainerMat) {
                        initialMatMappings[h] = retainerMat.name;
                        return;
                    }
                }

                const matchedMat = systemMaterials.find(m =>
                    m.name.toUpperCase() === hUpper ||
                    (m.code && m.code.toUpperCase() === hUpper) ||
                    m.name.toUpperCase().includes(hUpper) ||
                    hUpper.includes(m.name.toUpperCase())
                );
                if (matchedMat) {
                    initialMatMappings[h] = matchedMat.name;
                }
            });
            setMaterialMappings(initialMatMappings);
        };
        reader.readAsArrayBuffer(selectedFile);
    }, [systemMaterials]);

    // 2. Process Data
    const confirmMapping = () => {
        if (!workbook) return;

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let headerIdx = 0;
        for (let i = 0; i < Math.min(jsonDataRaw.length, 30); i++) {
            const rowStr = JSON.stringify(jsonDataRaw[i]).toUpperCase();
            if (rowStr.includes('RTOM') || rowStr.includes('VOICE')) { headerIdx = i; break; }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx }) as Record<string, string | number | Date | null>[];

        const rows: ParsedRow[] = jsonData.map((row, index) => {
            const getMapVal = (key: string) => row[fieldMappings[key]] || null;

            const parsed: ParsedRow = {
                serialNo: index + 1,
                rtom: String(getMapVal('rtom') || '').trim(),
                voiceNumber: String(getMapVal('voiceNumber') || '').trim(),
                orderType: String(getMapVal('orderType') || 'CREATE').trim(),
                receivedDate: parseExcelDate(getMapVal('receivedDate')),
                completedDate: parseExcelDate(getMapVal('completedDate')),
                package: String(getMapVal('package') || '').trim(),
                dropWireDistance: parseFloat(String(getMapVal('dropWireDistance') || '0')) || 0,
                contractorName: String(getMapVal('contractorName') || '').trim(),
                directTeamName: String(getMapVal('directTeamName') || '').trim(),
                materials: {}
            };

            // Map materials based on manual mappings
            Object.entries(materialMappings).forEach(([excelHeader, systemMatName]) => {
                if (systemMatName && systemMatName !== "none") {
                    const val = Number(row[excelHeader]);
                    if (!isNaN(val) && val > 0) {
                        parsed.materials[systemMatName] = (parsed.materials[systemMatName] || 0) + val;
                    }
                }
            });

            return parsed;
        }).filter(r => r.rtom || r.voiceNumber);


        if (rows.length === 0) {
            toast.error("No valid data found with current mapping");
        } else {
            setParsedData(rows);
            setIsMappingConfirmed(true);
            toast.success(`Mapping confirmed for ${rows.length} rows`);
        }
    };

    // 3. Batch Import
    const handleImport = async () => {
        if (parsedData.length === 0) return;
        setImporting(true);
        setProgress(0);
        setImportResults(null);

        try {
            const BATCH_SIZE = 100;
            let successCount = 0;
            let failedCount = 0;
            let skippedNoOpmc = 0;
            const errors: string[] = [];

            for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
                const batch = parsedData.slice(i, i + BATCH_SIZE);
                const response = await fetch('/api/service-orders/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rows: batch, skipMaterials })
                });

                const result = await response.json();
                if (result.success) {
                    successCount += result.summary.success;
                    failedCount += result.summary.failed;
                    skippedNoOpmc += result.summary.skippedNoOpmc || 0;
                    result.results?.filter((r: { success: boolean }) => !r.success).forEach((r: { rtom: string; voiceNumber: string; error: string }) => {
                        errors.push(`[${r.rtom}] ${r.voiceNumber}: ${r.error}`);
                    });
                } else {
                    failedCount += batch.length;
                    errors.push(result.error || 'Batch import failed');
                }
                setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
            }
            setImportResults({ success: successCount, failed: failedCount, skippedNoOpmc, errors });
        } catch (err: any) {
            toast.error(`Import Error: ${err.message}`);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">SOD Bulk Import (Legacy Data)</h1>
                                <p className="text-slate-500 mt-1">Manual Mapping Mode — ensuring 100% material mapping accuracy</p>
                            </div>
                        </div>

                        {/* Step 1: Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-md">1</div>
                                    Upload Excel
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all cursor-pointer relative">
                                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} id="file-input" className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <p className="text-xl font-semibold text-slate-700">{file ? file.name : "Choose CSV or Excel Profile"}</p>
                                    <p className="text-sm text-slate-500 mt-2">Compatible formats: .xlsx, .xls, .csv</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 2: Mapping */}
                        {file && detectedHeaders.length > 0 && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Field Mapping Card */}
                                <Card className={isMappingConfirmed ? "opacity-60 pointer-events-none" : "border-2"}>
                                    <CardHeader className="bg-slate-50/50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-md">2.1</div>
                                            SOD Detail Mapping
                                        </CardTitle>
                                        <CardDescription>Match basic order details</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 gap-4">
                                            {SYSTEM_FIELDS.map(field => (
                                                <div key={field.key} className="grid grid-cols-3 items-center gap-4">
                                                    <label className="text-sm font-medium text-slate-700">
                                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                                    </label>
                                                    <div className="col-span-2">
                                                        <Select
                                                            value={fieldMappings[field.key]}
                                                            onValueChange={(val) => setFieldMappings(prev => ({ ...prev, [field.key]: val }))}
                                                        >
                                                            <SelectTrigger className="w-full bg-white">
                                                                <SelectValue placeholder="Skip this field" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">-- Skip Field --</SelectItem>
                                                                {detectedHeaders.map(h => (
                                                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Material Mapping Card */}
                                <Card className={isMappingConfirmed ? "opacity-60 pointer-events-none" : "border-2"}>
                                    <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md">2.2</div>
                                                Material Usage Mapping
                                            </CardTitle>
                                            <CardDescription>Match Excel material columns to System Items</CardDescription>
                                        </div>
                                        <div className="px-3 py-1 bg-purple-100 rounded-full text-[10px] font-bold text-purple-700 uppercase">
                                            Manual Link
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                                            <p className="text-xs text-slate-400 italic mb-4">Select which Excel column represents a specific Material Item from the store.</p>

                                            {detectedHeaders.filter(h => !Object.values(fieldMappings).includes(h)).map((header, idx) => (
                                                <div key={idx} className="flex flex-col p-3 bg-slate-50/50 rounded-lg border border-slate-100 hover:border-purple-200 transition-colors">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-bold text-slate-700">{header}</span>
                                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                    <Select
                                                        value={materialMappings[header] || "none"}
                                                        onValueChange={(val) => setMaterialMappings(prev => ({ ...prev, [header]: val }))}
                                                    >
                                                        <SelectTrigger className="w-full bg-white h-9 border-purple-100 shadow-sm">
                                                            <SelectValue placeholder="Not a material column" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">-- Not a material --</SelectItem>
                                                            {systemMaterials.map(m => (
                                                                <SelectItem key={m.id} value={m.name}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Package className="w-3 h-3 text-slate-400" />
                                                                        <span>{m.name}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>

                                        {!isMappingConfirmed && (
                                            <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 py-6 font-bold text-lg" onClick={confirmMapping}>
                                                Apply & Preview <CheckCircle2 className="w-5 h-5 ml-2" />
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Step 3: Preview */}
                        {isMappingConfirmed && parsedData.length > 0 && (
                            <Card className="border-emerald-200 bg-emerald-50/10">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-md">3</div>
                                            Import Data
                                        </CardTitle>
                                        <CardDescription>Everything looks good. Ready to import.</CardDescription>
                                    </div>
                                    <Button variant="ghost" className="text-slate-500 hover:text-blue-600" onClick={() => setIsMappingConfirmed(false)}>
                                        <Settings2 className="w-4 h-4 mr-2" /> Back to Mapping
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {/* Small preview table */}
                                    <div className="bg-white rounded-xl border shadow-sm mb-6 max-h-60 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 sticky top-0 border-b">
                                                <tr>
                                                    <th className="p-3 text-left">RTOM</th>
                                                    <th className="p-3 text-left">Voice</th>
                                                    <th className="p-3 text-left">Materials Detected</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {parsedData.slice(0, 10).map((row, i) => (
                                                    <tr key={i}>
                                                        <td className="p-3 font-bold">{row.rtom}</td>
                                                        <td className="p-3 font-mono">{row.voiceNumber}</td>
                                                        <td className="p-3 truncate max-w-[300px]">
                                                            {Object.entries(row.materials).map(([k, v]) => (
                                                                <span key={k} className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded mr-1">
                                                                    {k}: {v}
                                                                </span>
                                                            ))}
                                                            {Object.keys(row.materials).length === 0 && <span className="text-slate-300 italic">No materials</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {importing && (
                                        <div className="mb-6 space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-bold">Progress</span>
                                                <span className="font-bold text-emerald-600">{progress}%</span>
                                            </div>
                                            <Progress value={progress} className="h-3 bg-white border" />
                                        </div>
                                    )}

                                    {importResults && (
                                        <Card className="mb-6 bg-slate-800 text-white border-0 overflow-hidden">
                                            <CardContent className="p-6">
                                                <div className="grid grid-cols-3 gap-6 text-center">
                                                    <div><p className="text-emerald-400 text-xs uppercase font-bold mb-1">Success</p><p className="text-3xl font-black">{importResults.success}</p></div>
                                                    <div><p className="text-red-400 text-xs uppercase font-bold mb-1">Failed</p><p className="text-3xl font-black">{importResults.failed}</p></div>
                                                    <div><p className="text-amber-400 text-xs uppercase font-bold mb-1">Skipped</p><p className="text-3xl font-black">{importResults.skippedNoOpmc}</p></div>
                                                </div>
                                                {importResults.errors.length > 0 && (
                                                    <div className="mt-4 p-3 bg-black/30 rounded text-left">
                                                        <p className="text-[10px] text-slate-400 mb-2">LAST 5 ERRORS:</p>
                                                        {importResults.errors.slice(-5).map((e, i) => <p key={i} className="text-[10px] text-red-300 font-mono truncate">{e}</p>)}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Button
                                        onClick={handleImport}
                                        disabled={importing}
                                        className="w-full py-8 text-xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200"
                                    >
                                        {importing ? <Loader2 className="w-6 h-6 animate-spin" /> : "START BULK IMPORT"}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
