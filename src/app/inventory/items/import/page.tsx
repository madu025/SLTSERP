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
        <div className="h-screen flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-6">

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Bulk Item Import</h1>
                            <p className="text-slate-500">Upload Excel sheet to register multiple items at once.</p>
                        </div>

                        <Card className="border-dashed border-2 border-slate-300">
                            <CardHeader className="text-center">
                                <div className="mx-auto bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                                </div>
                                <CardTitle>Upload Excel File</CardTitle>
                                <CardDescription>
                                    Format: <strong>Code, Name, Unit, Type, Category, MinLevel</strong>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center pb-10">
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        onChange={processFile}
                                        disabled={isProcessing}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <Button disabled={isProcessing} className="w-48">
                                        {isProcessing ? 'Processing...' : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" /> Select File
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">Supported file: .xlsx</p>
                            </CardContent>
                        </Card>

                        {stats && (
                            <Card className="bg-slate-50">
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                                        <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> Import Summary
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-white p-3 rounded border">
                                            <div className="text-xs text-slate-500 uppercase">Total Rows</div>
                                            <div className="text-xl font-bold text-slate-800">{stats.total}</div>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-emerald-200 bg-emerald-50">
                                            <div className="text-xs text-emerald-600 uppercase">Success</div>
                                            <div className="text-xl font-bold text-emerald-700">{stats.success}</div>
                                        </div>
                                        <div className="bg-white p-3 rounded border border-red-200 bg-red-50">
                                            <div className="text-xs text-red-600 uppercase">Failed</div>
                                            <div className="text-xl font-bold text-red-700">{stats.fail}</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-4 text-center">
                                        Note: Duplicates (Item Codes) are automatically skipped.
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
