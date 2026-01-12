"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, CheckCircle2, XCircle, Loader2, Link2, Shield, User, Store } from "lucide-react";
import readXlsxFile from 'read-excel-file';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface ImportSummary {
    total: number;
    success: number;
    failed: number;
    errors: { row: number; error: string }[];
}

export default function UserBulkImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [summary, setSummary] = useState<ImportSummary | null>(null);

    // Fetch necessary data for mapping
    const { data: opmcs = [] } = useQuery({ queryKey: ['opmcs'], queryFn: () => fetch('/api/opmcs').then(res => res.json()) });
    const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users?limit=1000').then(res => res.json()).then(d => d.users || []) });
    const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: () => fetch('/api/inventory/stores').then(res => res.json()) });

    const downloadTemplate = () => {
        const headers = ["Username", "Email", "Full Name", "Staff ID", "Password", "Role", "RTOMs", "Supervisor_Username", "Store_Name"];
        const csvContent = headers.join(",") + "\n" +
            "jdoe,jane@slt.lk,Jane Doe,E12345,Pass123!,ENGINEER,\"MT,GM\",admin_user,MAIN_STORE";

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_import_template.csv`;
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
        const rows = await readXlsxFile(file);
        const headers = rows[0].map(h => String(h).trim());
        const dataRows = rows.slice(1);

        let successCount = 0;
        let failedCount = 0;
        const errors: { row: number; error: string }[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowData: any = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index];
            });

            try {
                // Map RTOMs to IDs
                const rtoms = String(rowData['RTOMs'] || '').split(',').map(s => s.trim());
                const opmcIds = opmcs
                    .filter((o: any) => rtoms.includes(o.rtom))
                    .map((o: any) => o.id);

                // Map Supervisor Username to ID
                const supervisor = users.find((u: any) => u.username === String(rowData['Supervisor_Username']).trim());
                const supervisorId = supervisor?.id || undefined;

                // Map Store Name to ID
                const store = stores.find((s: any) => s.name === String(rowData['Store_Name']).trim());
                const assignedStoreId = store?.id || 'none';

                const payload = {
                    username: String(rowData['Username']).trim(),
                    email: String(rowData['Email']).trim(),
                    name: String(rowData['Full Name']).trim(),
                    employeeId: String(rowData['Staff ID']).trim(),
                    password: String(rowData['Password']).trim(),
                    role: String(rowData['Role']).trim().toUpperCase().replace(/ /g, '_'),
                    opmcIds,
                    supervisorId,
                    assignedStoreId
                };

                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Failed to create user');
                }

                successCount++;
            } catch (err: any) {
                failedCount++;
                errors.push({ row: i + 2, error: err.message });
            }
        }

        setSummary({
            total: dataRows.length,
            success: successCount,
            failed: failedCount,
            errors
        });
        setIsProcessing(false);
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS}>
            <div className="flex h-screen bg-slate-50">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto overflow-x-hidden pt-4">

                        <div className="p-8 max-w-5xl mx-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Bulk User Import</h1>
                                    <p className="text-slate-500 text-sm">Upload an Excel/XLSX file to register multiple users at once.</p>
                                </div>
                                <Button variant="outline" onClick={downloadTemplate} className="h-9 text-xs">
                                    <Download className="w-4 h-4 mr-2" /> Download Template (CSV)
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="md:col-span-1">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Upload className="w-4 h-4 text-blue-500" /> 1. Upload File
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer relative">
                                            <input
                                                type="file"
                                                accept=".xlsx"
                                                onChange={handleFileUpload}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <div className="space-y-2">
                                                <div className="h-10 w-10 bg-white shadow-sm rounded-lg flex items-center justify-center mx-auto border border-slate-100">
                                                    <Upload className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div className="text-xs font-medium text-slate-600">
                                                    {file ? file.name : "Choose XLSX file"}
                                                </div>
                                                <div className="text-[10px] text-slate-400">Excel Spreadsheets only</div>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full bg-slate-900 shadow-xl shadow-slate-200"
                                            onClick={processImport}
                                            disabled={!file || isProcessing}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Processing Rows...
                                                </>
                                            ) : "Start Import"}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-amber-500" /> Import Instructions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-xs text-slate-600 leading-relaxed">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 font-semibold text-slate-900">
                                                    <User className="w-3 h-3" /> Core Fields
                                                </div>
                                                <ul className="list-disc list-inside space-y-1 pl-1">
                                                    <li><strong>Role:</strong> Use standard codes (e.g., ENGINEER, MANAGER, SA_MANAGER)</li>
                                                    <li><strong>Email:</strong> Must be corporate SLT email (@slt.lk)</li>
                                                    <li><strong>Username:</strong> Must be unique & lowercase</li>
                                                </ul>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 font-semibold text-slate-900">
                                                    <Link2 className="w-3 h-3" /> Linkage Fields
                                                </div>
                                                <ul className="list-disc list-inside space-y-1 pl-1">
                                                    <li><strong>RTOMs:</strong> Comma separated RTOM codes (e.g. "MT, GM")</li>
                                                    <li><strong>Supervisor:</strong> SLT Username of the supervisor</li>
                                                    <li><strong>Store_Name:</strong> Exact name as in Inventory module</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {summary && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card className="bg-blue-50/50 border-blue-100 shadow-none">
                                            <CardContent className="pt-6 text-center">
                                                <div className="text-2xl font-bold text-blue-700">{summary.total}</div>
                                                <div className="text-[10px] uppercase tracking-wider font-bold text-blue-500 mt-1">Total Found</div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-green-50/50 border-green-100 shadow-none">
                                            <CardContent className="pt-6 text-center">
                                                <div className="text-2xl font-bold text-green-700">{summary.success}</div>
                                                <div className="text-[10px] uppercase tracking-wider font-bold text-green-500 mt-1">Succeeded</div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-red-50/50 border-red-100 shadow-none">
                                            <CardContent className="pt-6 text-center">
                                                <div className="text-2xl font-bold text-red-700">{summary.failed}</div>
                                                <div className="text-[10px] uppercase tracking-wider font-bold text-red-500 mt-1">Failed</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {summary.errors.length > 0 && (
                                        <Card className="border-red-100">
                                            <CardHeader className="bg-red-50/50 py-3">
                                                <CardTitle className="text-[11px] font-bold text-red-800 uppercase flex items-center gap-2">
                                                    <XCircle className="w-4 h-4" /> Top Error Logs
                                                </CardTitle>
                                            </CardHeader>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                        <TableHead className="w-20 text-[10px] font-bold uppercase py-2">Row</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-2">Error Description</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {summary.errors.slice(0, 10).map((err, i) => (
                                                        <TableRow key={i} className="text-[11px]">
                                                            <TableCell className="font-mono text-slate-500">#{err.row}</TableCell>
                                                            <TableCell className="text-red-600 font-medium">{err.error}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Card>
                                    )}

                                    {summary.success > 0 && (
                                        <div className="p-6 bg-slate-900 rounded-2xl flex items-center justify-between text-white shadow-2xl shadow-slate-200">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                                                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold">{summary.success} Users Provisioned</div>
                                                    <div className="text-xs text-slate-400">All successful registers are now active with assigned roles.</div>
                                                </div>
                                            </div>
                                            <Button className="bg-white text-slate-900 hover:bg-slate-100 font-bold" onClick={() => window.location.href = '/admin/users'}>
                                                Go to Users Directory
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
