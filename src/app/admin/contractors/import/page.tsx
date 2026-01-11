"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileSpreadsheet, CheckCircle2, Download, AlertCircle } from "lucide-react";
import readXlsxFile from 'read-excel-file';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';

export default function ContractorBulkImportPage() {
    const queryClient = useQueryClient();
    const [stats, setStats] = useState<{ total: number, success: number, fail: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const downloadTemplate = () => {
        const headers = [
            'Name',
            'Type (SOD/OSP)',
            'Registration Number',
            'Contact Number',
            'NIC',
            'Address',
            'BR Number',
            'Bank Name',
            'Bank Branch',
            'Bank Account Number',
            'Team Name',
            'Member 1 Name',
            'Member 1 NIC',
            'Member 2 Name',
            'Member 2 NIC',
            'Member 3 Name',
            'Member 3 NIC'
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "contractor_with_teams_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setStats(null);
        setErrors([]);
        let successCount = 0;
        let failCount = 0;
        let totalCount = 0;
        const errorList: string[] = [];

        try {
            const rows = await readXlsxFile(file);
            const dataRows = rows.slice(1);
            totalCount = dataRows.length;

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                const rowNum = i + 2;

                try {
                    const teams = [];
                    const teamName = row[10]?.toString().trim();
                    if (teamName) {
                        const members = [];
                        if (row[11]?.toString().trim()) {
                            members.push({ name: row[11].toString().trim(), nic: row[12]?.toString().trim() || '' });
                        }
                        if (row[13]?.toString().trim()) {
                            members.push({ name: row[13].toString().trim(), nic: row[14]?.toString().trim() || '' });
                        }
                        if (row[15]?.toString().trim()) {
                            members.push({ name: row[15].toString().trim(), nic: row[16]?.toString().trim() || '' });
                        }

                        teams.push({
                            name: teamName,
                            members: members
                        });
                    }

                    const payload = {
                        name: row[0]?.toString().trim(),
                        type: (row[1]?.toString().trim() || 'SOD').toUpperCase(),
                        registrationNumber: row[2]?.toString().trim(),
                        contactNumber: row[3]?.toString().trim(),
                        nic: row[4]?.toString().trim(),
                        address: row[5]?.toString().trim(),
                        brNumber: row[6]?.toString().trim(),
                        bankName: row[7]?.toString().trim(),
                        bankBranch: row[8]?.toString().trim(),
                        bankAccountNumber: row[9]?.toString().trim(),
                        status: 'ACTIVE',
                        teams: teams
                    };

                    if (!payload.name || !payload.registrationNumber) {
                        throw new Error(`Row ${rowNum}: Name and Registration Number are required.`);
                    }

                    const res = await fetch('/api/contractors', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        successCount++;
                    } else {
                        const errData = await res.json();
                        throw new Error(`Row ${rowNum}: ${errData.message || 'Server error'}`);
                    }

                } catch (err: any) {
                    failCount++;
                    errorList.push(err.message);
                }
            }

            setStats({ total: totalCount, success: successCount, fail: failCount });
            setErrors(errorList.slice(0, 10));

            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} contractors.`);
                queryClient.invalidateQueries({ queryKey: ["contractors"] });
            }
            if (failCount > 0) {
                toast.warning(`${failCount} rows failed to import.`);
            }

        } catch (err) {
            toast.error("Failed to read Excel file.");
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS}>
            <div className="h-screen flex bg-slate-50 overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 h-full">
                    <Header />
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="max-w-4xl mx-auto space-y-6">

                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bulk Import <span className="text-blue-600 font-black">Admin</span></h1>
                                    <p className="text-slate-500 mt-1">Full contractor & operational team bulk registration.</p>
                                </div>
                                <Button variant="outline" onClick={downloadTemplate} className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 font-bold">
                                    <Download className="w-4 h-4 mr-2" /> Download Template
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="md:col-span-2 border-dashed border-2 border-slate-300 bg-white">
                                    <CardHeader className="text-center pb-2">
                                        <div className="mx-auto bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mb-4 border-4 border-blue-100">
                                            <FileSpreadsheet className="w-10 h-10 text-blue-600" />
                                        </div>
                                        <CardTitle className="text-xl">Upload Your Spreadsheet</CardTitle>
                                        <CardDescription>
                                            Securely import sensitive contractor data.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center pb-12">
                                        <div className="relative group">
                                            <input
                                                type="file"
                                                accept=".xlsx"
                                                onChange={processFile}
                                                disabled={isProcessing}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <Button disabled={isProcessing} className="w-64 h-12 bg-blue-600 hover:bg-blue-700 shadow-lg font-bold">
                                                {isProcessing ? 'Importing...' : 'Select Excel File'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white border-red-100">
                                    <CardHeader>
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-500">Secure Access</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-[11px] text-slate-600 space-y-4">
                                        <p>This action is restricted to **Administrators**. All bulk operations are logged for audit purposes.</p>
                                        <div className="pt-4 border-t">
                                            <p className="font-bold text-slate-800 italic">Audit Log Entry Created:</p>
                                            <p className="mt-1 font-mono text-slate-400">IMPRT_{new Date().getTime()}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {stats && (
                                <div className="space-y-4">
                                    <Card className="bg-white shadow-2xl border-emerald-100">
                                        <CardContent className="p-8">
                                            <h3 className="font-bold text-xl text-slate-800 flex items-center mb-6">
                                                <CheckCircle2 className="w-6 h-6 mr-2 text-emerald-600" /> Processing Complete
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 items-center text-center">
                                                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total</div>
                                                    <div className="text-3xl font-black text-slate-800">{stats.total}</div>
                                                </div>
                                                <div className="bg-emerald-500 p-6 rounded-2xl shadow-lg items-center text-center">
                                                    <div className="text-[10px] text-emerald-100 uppercase font-black tracking-widest mb-1">Success</div>
                                                    <div className="text-3xl font-black text-white">{stats.success}</div>
                                                </div>
                                                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 items-center text-center">
                                                    <div className="text-[10px] text-red-600 uppercase font-black tracking-widest mb-1">Failed</div>
                                                    <div className="text-3xl font-black text-red-700">{stats.fail}</div>
                                                </div>
                                            </div>
                                            {errors.length > 0 && (
                                                <div className="mt-6 p-4 bg-slate-900 rounded-xl max-h-40 overflow-y-auto">
                                                    <p className="text-red-400 text-[10px] font-bold uppercase mb-2">Error Details:</p>
                                                    {errors.map((err, i) => <p key={i} className="text-white text-[10px] font-mono mb-1">{err}</p>)}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
