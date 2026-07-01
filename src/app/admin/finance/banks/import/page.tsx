"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import readXlsxFile from 'read-excel-file';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';

interface ImportSummary {
    total: number;
    success: number;
    failed: number;
    errors: { row: number; error: string }[];
}

export default function BankBulkImportPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [summary, setSummary] = useState<ImportSummary | null>(null);

    const downloadTemplate = () => {
        const headers = ["Bank_Code", "Bank_Name", "Branch_Code", "Branch_Name"];
        const csvContent = headers.join(",") + "\n" +
            "BOC,Bank of Ceylon,012,Borella\n" +
            "COMB,Commercial Bank,056,Kollupitiya";

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bank_import_template.csv`;
        a.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setSummary(null);
        }
    };

    const processImport = async () => {
        if (!file) return;

        setIsProcessing(true);
        try {
            const rows = await readXlsxFile(file);
            const headers = rows[0].map(h => String(h).trim());
            const dataRows = rows.slice(1);

            const banksData = dataRows.map(row => {
                const rowData: Record<string, any> = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                return {
                    bankCode: String(rowData['Bank_Code']).trim(),
                    bankName: String(rowData['Bank_Name']).trim(),
                    branchCode: rowData['Branch_Code'] ? String(rowData['Branch_Code']).trim() : null,
                    branchName: rowData['Branch_Name'] ? String(rowData['Branch_Name']).trim() : null,
                };
            });

            // Filter out empty rows
            const validData = banksData.filter(d => d.bankCode && d.bankName);

            const res = await fetch('/api/admin/finance/banks/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validData)
            });

            const result = await res.json();
            setSummary({
                total: validData.length,
                success: result.successCount || 0,
                failed: result.failedCount || 0,
                errors: result.errors || []
            });

        } catch (error) {
            console.error("Error reading file:", error);
            alert("Error processing file. Please ensure it's a valid Excel format.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS}>
            <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header title="Bulk Import Banks & Branches" />
                    
                    <div className="flex-1 overflow-auto p-4 lg:p-8">
                        <div className="max-w-4xl mx-auto space-y-6">
                            
                            <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center justify-between">
                                        Bank Data Upload
                                        <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download Template
                                        </Button>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-10 h-10 mb-3 text-slate-400" />
                                                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Excel files only (.xlsx)
                                                </p>
                                                {file && (
                                                    <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        Selected: {file.name}
                                                    </p>
                                                )}
                                            </div>
                                            <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                                        </label>
                                    </div>

                                    <div className="flex justify-end space-x-3">
                                        <Button variant="outline" onClick={() => router.back()}>
                                            Cancel
                                        </Button>
                                        <Button 
                                            onClick={processImport} 
                                            disabled={!file || isProcessing}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Start Import
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {summary && (
                                <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <CardHeader>
                                        <CardTitle className="text-xl">Import Results</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg flex items-center space-x-4">
                                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Rows</p>
                                                    <h3 className="text-2xl font-bold">{summary.total}</h3>
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg flex items-center space-x-4">
                                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                                    <CheckCircle2 className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Successful</p>
                                                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.success}</h3>
                                                </div>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg flex items-center space-x-4">
                                                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                                                    <XCircle className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Failed</p>
                                                    <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</h3>
                                                </div>
                                            </div>
                                        </div>

                                        {summary.errors.length > 0 && (
                                            <div className="border border-red-200 dark:border-red-900/30 rounded-lg overflow-hidden">
                                                <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-200 dark:border-red-900/30">
                                                    <h4 className="text-sm font-semibold text-red-800 dark:text-red-400 flex items-center">
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                        Error Details
                                                    </h4>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-24">Row</TableHead>
                                                                <TableHead>Error Message</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {summary.errors.map((err, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="font-medium text-slate-500">{err.row}</TableCell>
                                                                    <TableCell className="text-red-600 dark:text-red-400">{err.error}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
