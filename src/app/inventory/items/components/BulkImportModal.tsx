import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDesc } from "@/components/ui/card";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import readXlsxFile from 'read-excel-file';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface BulkImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BulkImportModal({ open, onOpenChange }: BulkImportModalProps) {
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
            toast.error("Failed to read Excel file. Check format.");
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white border-slate-200 shadow-xl overflow-hidden p-0 rounded-2xl">
                <DialogHeader className="bg-slate-50/50 p-6 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center border border-blue-200">
                            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Bulk Item Import</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 font-medium mt-1">
                                Upload an Excel sheet to register multiple items.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <Card className="border-dashed border-2 border-slate-200 bg-white rounded-xl shadow-none overflow-hidden">
                        <CardHeader className="text-center pb-2 px-4 pt-4">
                            <CardTitle className="text-sm font-bold text-slate-800">Upload Excel File (.xlsx)</CardTitle>
                            <CardDesc className="text-xs text-slate-500 mt-1">
                                Expected columns:<br/>
                                <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono text-slate-800 mt-1 inline-block">
                                    Code, Name, Unit, Type, Category, MinLevel
                                </code>
                            </CardDesc>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center pb-4">
                            <div className="relative mt-2">
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    onChange={processFile}
                                    disabled={isProcessing}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button disabled={isProcessing} size="sm" className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm">
                                    {isProcessing ? 'Processing...' : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" /> Select & Upload File
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {stats && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <h3 className="font-bold text-slate-800 text-xs flex items-center">
                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" /> Import Summary
                            </h3>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <div className="text-[9px] text-slate-400 font-semibold uppercase">Total Rows</div>
                                    <div className="text-sm font-bold text-slate-700">{stats.total}</div>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 shadow-sm">
                                    <div className="text-[9px] text-emerald-600 font-semibold uppercase">Success</div>
                                    <div className="text-sm font-bold text-emerald-700">{stats.success}</div>
                                </div>
                                <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 shadow-sm">
                                    <div className="text-[9px] text-rose-600 font-semibold uppercase">Failed</div>
                                    <div className="text-sm font-bold text-rose-700">{stats.fail}</div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 text-center font-medium mt-1">
                                Duplicate Item Codes are automatically skipped.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
