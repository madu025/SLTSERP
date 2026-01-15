"use client";

import React, { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download, Loader2 } from 'lucide-react';
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

// Material columns to extract
const MATERIAL_COLUMNS = [
    'F-1', 'G-1', 'DW-RT', 'L-HOOK', 'C-HOOK', 'TOP BOLT', 'E 1- ROSSET',
    'FAC CONNECTORS', 'IN-W SINGLE PAIR', 'CABLE CAT5E', 'TL-N', 'CABLE TIE (PCs)',
    'CONDUIT (m)', 'CONDUIT CLIPS', 'CON-NAIL', 'FLEXIBLE', 'CONNECTOR  RJ11',
    'SINGLE ROSETTE', 'U CLIP', 'CONNECTOR RJ 45', 'CASING'
];

function parseExcelDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
}

export default function SODImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; skippedNoOpmc: number; errors: string[] } | null>(null);
    const [skipMaterials, setSkipMaterials] = useState(false);

    // Get unique RTOMs from parsed data
    const uniqueRtoms = [...new Set(parsedData.map(r => r.rtom).filter(Boolean))];

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setParsedData([]);
        setImportResults(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, unknown>[];

                // Parse rows
                const rows: ParsedRow[] = jsonData.map((row, index) => {
                    const parsed: ParsedRow = {
                        serialNo: index + 1,
                        rtom: String(row['RTOM'] || ''),
                        voiceNumber: String(row['TP NUMBER'] || ''),
                        orderType: String(row['SERVICE ORDER TYPE (Create, Migration,Modify)'] || 'CREATE'),
                        receivedDate: parseExcelDate(row['SOD RECEIVED DATE']),
                        completedDate: parseExcelDate(row['SOD COMPLETE DATE']),
                        package: String(row['FTTH_PACKAGE'] || ''),
                        dropWireDistance: parseFloat(String(row['DW-RT'] || '0')) || 0,
                        contractorName: String(row['Contractor Names'] || ''),
                        directTeamName: String(row['Direct labor Names'] || ''),
                        materials: {}
                    };

                    // Extract material quantities
                    for (const col of MATERIAL_COLUMNS) {
                        const val = row[col];
                        if (val && typeof val === 'number' && val > 0) {
                            parsed.materials[col] = val;
                        }
                    }

                    return parsed;
                });

                setParsedData(rows);
                toast.success(`Parsed ${rows.length} rows from Excel`);
            } catch (err) {
                console.error('Excel parsing error:', err);
                toast.error('Failed to parse Excel file');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    }, []);

    const handleImport = async () => {
        if (parsedData.length === 0) {
            toast.error('No data to import');
            return;
        }

        setImporting(true);
        setProgress(0);
        setImportResults(null);

        try {
            // Import in batches
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
                    body: JSON.stringify({
                        rows: batch,
                        skipMaterials
                    })
                });

                const result = await response.json();

                if (result.success) {
                    successCount += result.summary.success;
                    failedCount += result.summary.failed;
                    skippedNoOpmc += result.summary.skippedNoOpmc || 0;
                    result.results
                        .filter((r: { success: boolean }) => !r.success)
                        .forEach((r: { voiceNumber: string; rtom: string; error: string }) => {
                            errors.push(`[${r.rtom}] ${r.voiceNumber}: ${r.error}`);
                        });
                } else {
                    failedCount += batch.length;
                    errors.push(result.error || 'Batch import failed');
                }

                setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
            }

            setImportResults({ success: successCount, failed: failedCount, skippedNoOpmc, errors });

            if (failedCount === 0) {
                toast.success(`Successfully imported ${successCount} SODs`);
            } else {
                toast.warning(`Imported ${successCount} SODs, ${failedCount} failed`);
            }
        } catch (err) {
            console.error('Import error:', err);
            toast.error('Import failed');
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'S/N', 'RTOM', 'TP NUMBER', 'SERVICE ORDER TYPE (Create, Migration,Modify)',
            'SOD RECEIVED DATE', 'SOD COMPLETE DATE', 'FTTH_PACKAGE', 'DW-RT',
            ...MATERIAL_COLUMNS, 'Direct labor Names', 'Contractor Names'
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SOD Import');
        XLSX.writeFile(wb, 'SOD_Import_Template.xlsx');
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9fc]">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Import Historical SODs</h1>
                                <p className="text-slate-500 mt-1">Import completed service orders from Excel files (All RTOMs)</p>
                            </div>
                            <Button variant="outline" onClick={downloadTemplate}>
                                <Download className="w-4 h-4 mr-2" />
                                Download Template
                            </Button>
                        </div>

                        {/* Step 1: Upload File */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">1</span>
                                    Upload Excel File
                                </CardTitle>
                                <CardDescription>
                                    Upload your SOD Excel file. RTOM will be auto-detected from the RTOM column.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                                        {file ? (
                                            <div>
                                                <p className="font-medium text-slate-700">{file.name}</p>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {parsedData.length} rows parsed
                                                </p>
                                                {uniqueRtoms.length > 0 && (
                                                    <p className="text-xs text-blue-600 mt-2">
                                                        RTOMs detected: {uniqueRtoms.join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                                                <p className="text-sm text-slate-500 mt-1">XLSX or XLS files only</p>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {/* Options */}
                                <div className="mt-4 flex items-center gap-2">
                                    <Checkbox
                                        id="skip-materials"
                                        checked={skipMaterials}
                                        onCheckedChange={(checked) => setSkipMaterials(checked as boolean)}
                                    />
                                    <label htmlFor="skip-materials" className="text-sm text-slate-600">
                                        Skip material usage import (faster import)
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 2: Preview & Import */}
                        {parsedData.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">2</span>
                                        Preview & Import
                                    </CardTitle>
                                    <CardDescription>Review parsed data and start import</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {/* Preview Table */}
                                    <div className="border rounded-lg overflow-hidden mb-4">
                                        <div className="max-h-64 overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">#</th>
                                                        <th className="px-3 py-2 text-left">RTOM</th>
                                                        <th className="px-3 py-2 text-left">TP Number</th>
                                                        <th className="px-3 py-2 text-left">Order Type</th>
                                                        <th className="px-3 py-2 text-left">Completed</th>
                                                        <th className="px-3 py-2 text-left">Contractor</th>
                                                        <th className="px-3 py-2 text-right">DW (m)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {parsedData.slice(0, 10).map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="px-3 py-2">{row.serialNo}</td>
                                                            <td className="px-3 py-2 font-medium text-blue-600">{row.rtom}</td>
                                                            <td className="px-3 py-2 font-mono">{row.voiceNumber}</td>
                                                            <td className="px-3 py-2">{row.orderType}</td>
                                                            <td className="px-3 py-2">
                                                                {row.completedDate ? new Date(row.completedDate).toLocaleDateString() : '-'}
                                                            </td>
                                                            <td className="px-3 py-2">{row.contractorName || row.directTeamName || '-'}</td>
                                                            <td className="px-3 py-2 text-right">{row.dropWireDistance}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {parsedData.length > 10 && (
                                            <div className="bg-slate-50 px-3 py-2 text-sm text-slate-500 text-center">
                                                ...and {parsedData.length - 10} more rows
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress */}
                                    {importing && (
                                        <div className="mb-4">
                                            <Progress value={progress} className="h-2" />
                                            <p className="text-sm text-slate-500 mt-2 text-center">
                                                Importing... {progress}%
                                            </p>
                                        </div>
                                    )}

                                    {/* Results */}
                                    {importResults && (
                                        <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="flex items-center gap-2 text-emerald-600">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                    <span className="font-medium">{importResults.success} Imported</span>
                                                </div>
                                                {importResults.failed > 0 && (
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle className="w-5 h-5" />
                                                        <span className="font-medium">{importResults.failed} Failed</span>
                                                    </div>
                                                )}
                                                {importResults.skippedNoOpmc > 0 && (
                                                    <div className="flex items-center gap-2 text-amber-600">
                                                        <AlertCircle className="w-5 h-5" />
                                                        <span className="font-medium">{importResults.skippedNoOpmc} OPMC not found</span>
                                                    </div>
                                                )}
                                            </div>
                                            {importResults.errors.length > 0 && (
                                                <div className="mt-3 max-h-32 overflow-auto">
                                                    {importResults.errors.slice(0, 10).map((err, i) => (
                                                        <div key={i} className="text-sm text-red-600 flex items-start gap-1">
                                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                            {err}
                                                        </div>
                                                    ))}
                                                    {importResults.errors.length > 10 && (
                                                        <p className="text-sm text-slate-500 mt-2">
                                                            ...and {importResults.errors.length - 10} more errors
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Import Button */}
                                    <Button
                                        onClick={handleImport}
                                        disabled={importing}
                                        className="w-full"
                                        size="lg"
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Import {parsedData.length} SODs
                                            </>
                                        )}
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
