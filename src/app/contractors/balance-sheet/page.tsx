"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface BalanceSheetItem {
    id: string;
    itemId: string;
    openingBalance: number;
    received: number;
    returned: number;
    used: number;
    wastage: number;
    closingBalance: number;
    item: {
        id: string;
        name: string;
        code: string;
        unit: string;
        category?: string;
    };
}

interface BalanceSheet {
    id: string;
    contractorId: string;
    storeId: string;
    month: string;
    contractor: {
        id: string;
        name: string;
        registrationNumber: string | null;
    };
    store: {
        id: string;
        name: string;
    };
    items: BalanceSheetItem[];
    generatedAt: string;
}

interface Team {
    id: string;
    name: string;
    opmcId: string;
    opmc: {
        id: string;
        name: string;
    };
    storeAssignments: Array<{
        storeId: string;
        isPrimary: boolean;
        store: {
            id: string;
            name: string;
        };
    }>;
}

interface Contractor {
    id: string;
    name: string;
    registrationNumber: string | null;
    teams: Team[];
}

const formatCategory = (cat: string) => {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function ContractorBalanceSheetPage() {
    const currentDate = new Date();
    const [selectedContractorId, setSelectedContractorId] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [selectedStoreId, setSelectedStoreId] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(
        `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    );

    // Fetch contractors with teams
    const { data: contractorsData } = useQuery<any>({
        queryKey: ["contractors"],
        queryFn: async () => {
            const res = await fetch("/api/contractors?page=1&limit=1000");
            if (!res.ok) throw new Error("Failed to fetch contractors");
            return res.json();
        }
    });

    const contractors: Contractor[] = Array.isArray(contractorsData?.contractors)
        ? contractorsData.contractors
        : [];

    // Get selected contractor's teams
    const selectedContractor = contractors.find(c => c.id === selectedContractorId);
    const teams = selectedContractor?.teams || [];

    // Get selected team's stores
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const stores = selectedTeam?.storeAssignments?.map(sa => sa.store) || [];

    // Auto-select primary store when team changes
    useEffect(() => {
        if (selectedTeam) {
            const primaryStore = selectedTeam.storeAssignments.find(sa => sa.isPrimary);
            if (primaryStore) {
                setSelectedStoreId(primaryStore.storeId);
            } else if (selectedTeam.storeAssignments.length > 0) {
                setSelectedStoreId(selectedTeam.storeAssignments[0].storeId);
            }
        }
    }, [selectedTeamId, selectedTeam]);

    // Fetch balance sheet
    const { data: balanceSheet, isLoading, refetch } = useQuery<BalanceSheet>({
        queryKey: ["contractor-balance-sheet", selectedContractorId, selectedStoreId, selectedMonth],
        queryFn: async () => {
            const res = await fetch(
                `/api/contractors/balance-sheet?contractorId=${selectedContractorId}&storeId=${selectedStoreId}&month=${selectedMonth}`
            );
            if (!res.ok) throw new Error("Failed to fetch balance sheet");
            return res.json();
        },
        enabled: !!selectedContractorId && !!selectedStoreId && !!selectedMonth
    });

    // Fetch preview data
    const { data: previewData } = useQuery({
        queryKey: ["balance-sheet-preview", selectedContractorId, selectedStoreId, selectedMonth],
        queryFn: async () => {
            const res = await fetch(
                `/api/contractors/balance-sheet/preview?contractorId=${selectedContractorId}&storeId=${selectedStoreId}&month=${selectedMonth}`
            );
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!selectedContractorId && !!selectedStoreId && !!selectedMonth && !balanceSheet
    });

    // Group and Sort Items
    const groupedItems = useMemo(() => {
        if (!balanceSheet) return {};

        const groups: Record<string, BalanceSheetItem[]> = {};

        balanceSheet.items.forEach(item => {
            const category = item.item.category || "OTHERS";
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
        });

        // Sort items within groups by Code
        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => a.item.code.localeCompare(b.item.code));
        });

        return groups;
    }, [balanceSheet]);

    const sortedCategories = useMemo(() => {
        return Object.keys(groupedItems).sort();
    }, [groupedItems]);

    const handleGenerate = async () => {
        try {
            const res = await fetch("/api/contractors/balance-sheet/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contractorId: selectedContractorId,
                    storeId: selectedStoreId,
                    month: selectedMonth
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to generate");
            }

            toast.success("Balance sheet generated successfully");
            refetch();
        } catch (error: any) {
            toast.error(error.message || "Failed to generate balance sheet");
        }
    };

    const handleExport = () => {
        if (!balanceSheet) return;

        let csvRows = [
            ["Contractor", balanceSheet.contractor.name],
            ["Registration No", balanceSheet.contractor.registrationNumber || 'N/A'],
            ["Store", balanceSheet.store.name],
            ["Month", balanceSheet.month],
            [],
            ["Category", "Item Code", "Item Name", "Unit", "Opening", "Received", "Used", "Wastage", "Returned", "Closing"]
        ];

        sortedCategories.forEach(category => {
            groupedItems[category].forEach(item => {
                csvRows.push([
                    category,
                    item.item.code,
                    item.item.name,
                    item.item.unit,
                    item.openingBalance.toFixed(2),
                    item.received.toFixed(2),
                    item.used.toFixed(2),
                    item.wastage.toFixed(2),
                    item.returned.toFixed(2),
                    item.closingBalance.toFixed(2)
                ]);
            });
        });

        const csvContent = csvRows.map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `balance-sheet-${balanceSheet.contractor.name}-${balanceSheet.month}.csv`;
        a.click();
    };

    // Calculate totals
    const totals = balanceSheet?.items.reduce((acc, item) => ({
        opening: acc.opening + item.openingBalance,
        received: acc.received + item.received,
        used: acc.used + item.used,
        wastage: acc.wastage + item.wastage,
        returned: acc.returned + item.returned,
        closing: acc.closing + item.closingBalance
    }), { opening: 0, received: 0, used: 0, wastage: 0, returned: 0, closing: 0 });

    const formatQty = (qty: number) => {
        return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:overflow-visible">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 print:p-0 print:overflow-visible">
                    <div className="max-w-7xl mx-auto space-y-4 print:space-y-0">
                        <div className="erp-toolbar p-3 bg-white border-slate-200 rounded-lg shadow-sm print:hidden">
                            <div className="flex flex-wrap items-end gap-3 w-full">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Contractor</label>
                                    <Select
                                        value={selectedContractorId}
                                        onValueChange={(val) => {
                                            setSelectedContractorId(val);
                                            setSelectedTeamId("");
                                            setSelectedStoreId("");
                                        }}
                                    >
                                        <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                                            <SelectValue placeholder="Select Contractor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {contractors.map((c) => (
                                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                                    {c.registrationNumber ? `${c.registrationNumber} - ${c.name}` : c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-[180px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Team</label>
                                    <Select
                                        value={selectedTeamId}
                                        onValueChange={(val) => {
                                            setSelectedTeamId(val);
                                        }}
                                        disabled={!selectedContractorId}
                                    >
                                        <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                                            <SelectValue placeholder="Select Team" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teams.map((t) => (
                                                <SelectItem key={t.id} value={t.id} className="text-xs">
                                                    {t.name} ({t.opmc.name})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-[180px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Store</label>
                                    <Select
                                        value={selectedStoreId}
                                        onValueChange={setSelectedStoreId}
                                        disabled={!selectedTeamId}
                                    >
                                        <SelectTrigger className="h-8 text-xs border-slate-200 bg-white">
                                            <SelectValue placeholder="Select Store" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stores.map((s) => (
                                                <SelectItem key={s.id} value={s.id} className="text-xs">
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-[150px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Month</label>
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="w-full h-8 px-3 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => refetch()}
                                        disabled={!selectedContractorId || !selectedStoreId || isLoading}
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-slate-500 border-slate-200 shadow-sm"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        onClick={handleGenerate}
                                        disabled={!selectedContractorId || !selectedStoreId}
                                        size="sm"
                                        className="h-8 px-4 text-xs shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                                        Generate
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Preview Card - Show before generation */}
                        {!balanceSheet && previewData && previewData.summary.hasData && (
                            <Card className="mb-4 border-blue-100 bg-blue-50/50 shadow-sm print:hidden">
                                <CardHeader className="py-2.5 px-4">
                                    <CardTitle className="text-sm font-bold text-blue-900">Balance Sheet Preview</CardTitle>
                                    <p className="text-xs text-blue-700">
                                        {previewData.contractor.name} - {previewData.store.name} ({previewData.month})
                                    </p>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                        <div className="bg-white p-3 rounded-lg border border-blue-100/70">
                                            <div className="text-xs text-slate-500 mb-0.5">Material Issues</div>
                                            <div className="text-xl font-bold text-green-600">
                                                {previewData.summary.materialIssues}
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-blue-100/70">
                                            <div className="text-xs text-slate-500 mb-0.5">SOD Usage</div>
                                            <div className="text-xl font-bold text-blue-600">
                                                {previewData.summary.sodUsage}
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-blue-100/70">
                                            <div className="text-xs text-slate-500 mb-0.5">Material Returns</div>
                                            <div className="text-xl font-bold text-purple-600">
                                                {previewData.summary.materialReturns}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-blue-700 bg-blue-50/70 p-2 rounded border border-blue-100/50">
                                        ℹ️ Click "Generate" to create the balance sheet with these transactions
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* No Data Message */}
                        {!balanceSheet && previewData && !previewData.summary.hasData && (
                            <Card className="mb-4 border-amber-100 bg-amber-50/50 shadow-sm print:hidden">
                                <CardContent className="py-6 text-center text-xs">
                                    <p className="text-amber-800 font-bold">No material transactions found for this period</p>
                                    <p className="text-slate-500 mt-1">
                                        There are no material issues, returns, or SOD usage for {previewData.month}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Loading State */}
                        {isLoading && (
                            <div className="text-center py-12 text-xs text-slate-500">Loading balance sheet...</div>
                        )}

                        {/* Balance Sheet Report (ERP Style - Grouped) */}
                        {!isLoading && balanceSheet && (
                            <Card className="border-slate-200 shadow-sm print:border-none print:shadow-none">
                                <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-slate-100 print:hidden">
                                    <div>
                                        <CardTitle className="text-sm font-bold text-slate-800">Balance Sheet Report</CardTitle>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Generated on {new Date().toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => window.print()} variant="outline" size="sm" className="h-8 text-xs border-slate-200 shadow-sm">
                                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                                            Print
                                        </Button>
                                        <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs border-slate-200 shadow-sm">
                                            <Download className="w-3.5 h-3.5 mr-1.5" />
                                            Export CSV
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {/* Formal Report Header for Print/View */}
                                    <div className="mb-6 border-b border-slate-200 pb-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">SLT Services</h1>
                                                <p className="text-[11px] text-slate-500">Material Management System</p>
                                                <p className="text-[11px] text-slate-500">Contractor Balance Sheet</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-slate-900">{balanceSheet.month}</div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">Report Period</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 mt-4">
                                            <div>
                                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Contractor Details</h3>
                                                <div className="text-slate-900 font-bold text-sm">{balanceSheet.contractor.name}</div>
                                                <div className="text-slate-500 text-xs">Reg No: {balanceSheet.contractor.registrationNumber || 'N/A'}</div>
                                            </div>
                                            <div className="text-right">
                                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Store Details</h3>
                                                <div className="text-slate-900 font-bold text-sm">{balanceSheet.store.name}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="erp-table-container overflow-hidden bg-white print:border-slate-300">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="border border-slate-200 px-3 py-1.5 text-left font-bold text-slate-600 text-[10px] uppercase tracking-wider">Item Code</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-left font-bold text-slate-600 text-[10px] uppercase tracking-wider">Item Name</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-center font-bold text-slate-600 text-[10px] uppercase tracking-wider">Unit</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-600 text-[10px] uppercase tracking-wider bg-slate-50/55">Opening</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-600 text-[10px] uppercase tracking-wider">Received</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-600 text-[10px] uppercase tracking-wider">Used</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-600 text-[10px] uppercase tracking-wider">Wastage</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-600 text-[10px] uppercase tracking-wider">Returned</th>
                                                    <th className="border border-slate-200 px-3 py-1.5 text-right font-bold text-slate-900 text-[10px] uppercase tracking-wider bg-slate-50/55">Closing</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedCategories.map(category => (
                                                    <React.Fragment key={category}>
                                                        {/* Category Header */}
                                                        <tr className="bg-slate-100 border-b border-slate-200">
                                                            <td colSpan={9} className="px-3 py-1 font-bold text-slate-800 text-[10px] uppercase tracking-wider border border-slate-200">
                                                                {formatCategory(category)}
                                                            </td>
                                                        </tr>

                                                        {/* Items in Category */}
                                                        {groupedItems[category].map((item) => (
                                                            <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50/30">
                                                                <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 border border-slate-200">{item.item.code}</td>
                                                                <td className="px-3 py-1.5 border border-slate-200 text-slate-800">{item.item.name}</td>
                                                                <td className="px-3 py-1.5 text-center text-slate-500 border border-slate-200">{item.item.unit}</td>
                                                                <td className="px-3 py-1.5 text-right bg-slate-50/20 border border-slate-200">{formatQty(item.openingBalance)}</td>
                                                                <td className="px-3 py-1.5 text-right text-green-700 font-medium border border-slate-200">
                                                                    {item.received > 0 ? formatQty(item.received) : '-'}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right text-blue-700 font-medium border border-slate-200">
                                                                    {item.used > 0 ? formatQty(item.used) : '-'}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right text-orange-700 border border-slate-200">
                                                                    {item.wastage > 0 ? formatQty(item.wastage) : '-'}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right text-purple-700 border border-slate-200">
                                                                    {item.returned > 0 ? formatQty(item.returned) : '-'}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right font-bold bg-slate-50/50 border border-slate-200 text-slate-900">
                                                                    {formatQty(item.closingBalance)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                            {totals && balanceSheet.items.length > 0 && (
                                                <tfoot>
                                                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-[11px]" colSpan={3}>TOTAL:</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right">{formatQty(totals.opening)}</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-green-700">{formatQty(totals.received)}</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-blue-700">{formatQty(totals.used)}</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-orange-700">{formatQty(totals.wastage)}</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-purple-700">{formatQty(totals.returned)}</td>
                                                        <td className="border border-slate-200 px-3 py-1.5 text-right text-slate-900">{formatQty(totals.closing)}</td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>

                                    {balanceSheet.items.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 border border-slate-200 rounded-lg mt-4 text-xs italic">
                                            No material movements recorded for this period.
                                        </div>
                                    )}

                                    {/* Signature Section */}
                                    <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t break-inside-avoid print:mt-12">
                                        <div className="text-center">
                                            <div className="border-b border-slate-300 w-3/4 mx-auto mb-2"></div>
                                            <div className="text-xs font-bold text-slate-800">Prepared By</div>
                                            <div className="text-[10px] text-slate-500">Stores Assistant</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="border-b border-slate-300 w-3/4 mx-auto mb-2"></div>
                                            <div className="text-xs font-bold text-slate-800">Checked By</div>
                                            <div className="text-[10px] text-slate-500">Stores Manager</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="border-b border-slate-300 w-3/4 mx-auto mb-2"></div>
                                            <div className="text-xs font-bold text-slate-800">Contractor Signature</div>
                                            <div className="text-[10px] text-slate-500">Date: ........................</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {!isLoading && !balanceSheet && selectedContractorId && selectedStoreId && (
                            <Card className="print:hidden border-slate-200 shadow-sm">
                                <CardContent className="py-12 text-center text-xs text-slate-400 italic">
                                    No balance sheet found. Click "Generate" to create one.
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
