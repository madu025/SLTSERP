"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import readXlsxFile from 'read-excel-file';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function BulkImportPage() {
    const queryClient = useQueryClient();
    const [stats, setStats] = useState<{ total: number, success: number, fail: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setStats(null);
        let successCount = 0;
        let failCount = 0;
        let totalCount = 0;

        try {
            const rows = await readXlsxFile(file);
            // Expecting rows: [Code, Name, Unit, Type, Category, MinLevel]
            // Skip header
            const dataRows = rows.slice(1);
            totalCount = dataRows.length;

            for (const row of dataRows) {
                try {
                    const payload = {
                        code: row[0]?.toString(),
                        name: row[1]?.toString(),
                        unit: row[2]?.toString() || 'Nos',
                        type: row[3]?.toString() || 'SLTS',
                        category: row[4]?.toString() || 'OTHERS',
                        minLevel: row[5]?.toString() || '0'
                    };

                    const res = await fetch('/api/inventory/items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) successCount++;
                    else failCount++;

                } catch (err) {
                    failCount++;
                }
            }

            setStats({ total: totalCount, success: successCount, fail: failCount });
            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} items.`);
                queryClient.invalidateQueries({ queryKey: ['items'] });
            }
            if (failCount > 0) {
                toast.warning(`${failCount} items failed to import.`);
            }

        } catch (err) {
            toast.error("Failed to read Excel file. check format.");
        } finally {
            setIsProcessing(false);
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-xl mx-auto space-y-4">

                        <div className="space-y-0.5">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Bulk Item Import</h1>
                            <p className="text-xs text-slate-500">Upload Excel sheet to register multiple items at once</p>
                        </div>

                        <Card className="border-dashed border-2 border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto bg-blue-50/50 w-12 h-12 rounded-lg flex items-center justify-center mb-2 border border-blue-100">
                                    <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                                </div>
                                <CardTitle className="text-sm font-bold text-slate-800">Upload Excel File</CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    Expected columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">Code, Name, Unit, Type, Category, MinLevel</code>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center pb-6">
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        onChange={processFile}
                                        disabled={isProcessing}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <Button disabled={isProcessing} size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm">
                                        {isProcessing ? 'Processing...' : (
                                            <>
                                                <Upload className="w-3.5 h-3.5 mr-1.5" /> Select File
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Supported formats: .xlsx</p>
                            </CardContent>
                        </Card>

                        {stats && (
                            <Card className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <CardContent className="p-4 space-y-3">
                                    <h3 className="font-bold text-slate-800 text-xs flex items-center">
                                        <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" /> Import Summary
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="text-[9px] text-slate-400 font-semibold uppercase">Total Rows</div>
                                            <div className="text-sm font-bold text-slate-700">{stats.total}</div>
                                        </div>
                                        <div className="bg-emerald-50/40 p-2 rounded-lg border border-emerald-100">
                                            <div className="text-[9px] text-emerald-600 font-semibold uppercase">Success</div>
                                            <div className="text-sm font-bold text-emerald-700">{stats.success}</div>
                                        </div>
                                        <div className="bg-rose-50/40 p-2 rounded-lg border border-rose-100">
                                            <div className="text-[9px] text-rose-600 font-semibold uppercase">Failed</div>
                                            <div className="text-sm font-bold text-rose-700">{stats.fail}</div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center font-medium">
                                        Note: Duplicate Item Codes are automatically skipped.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
