"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    TrendingUp, 
    ShoppingCart, 
    AlertTriangle, 
    Calendar, 
    RefreshCw, 
    CheckSquare, 
    Square, 
    Sparkles, 
    FileText,
    FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";

interface ProjectType {
    id: string;
    projectCode: string;
    name: string;
}

interface VendorType {
    id: string;
    code: string;
    name: string;
}

interface ForecastItem {
    itemId: string;
    itemCode: string;
    itemName: string;
    unit: string;
    currentStock: number;
    avgMonthlyConsumption: number;
    targetMonthlyDemand: number;
    predictedDemand: number;
    shortfall: number;
    recommendedQty: number;
    unitPrice: number;
    projectedCost: number;
    isLowStock: boolean;
}

interface ExpiryWarning {
    batchNumber: string;
    itemName: string;
    storeName: string;
    quantity: number;
    expiryDate: string;
}

export default function ProcurementForecastPage() {
    const queryClient = useQueryClient();
    
    // Projections config
    const [months, setMonths] = useState<number>(1);
    const [target, setTarget] = useState<number>(500);

    // Selected shortfall items for draft PO
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    
    // Dialog control
    const [showPODialog, setShowPODialog] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [poTitle, setPoTitle] = useState('');

    // Fetch Forecast Projections
    const { data: forecast = [], isLoading: isLoadingForecast, refetch: refetchForecast } = useQuery<ForecastItem[]>({
        queryKey: ['procurement-forecast', months, target],
        queryFn: async () => {
            const res = await fetch(`/api/procurement/forecast?months=${months}&target=${target}`);
            return res.json();
        }
    });

    // Fetch Expiry Warnings
    const { data: expiryData, isLoading: isLoadingExpiry, refetch: refetchExpiry } = useQuery<{ success: boolean; warnings: ExpiryWarning[] }>({
        queryKey: ['expiry-warnings'],
        queryFn: async () => {
            const res = await fetch('/api/procurement/expiry-check');
            return res.json();
        }
    });
    const warnings = expiryData?.warnings || [];

    // Fetch active projects for dropdown
    const { data: projects = [] } = useQuery<ProjectType[]>({
        queryKey: ['active-projects-for-po'],
        queryFn: async () => {
            const res = await fetch('/api/projects');
            return Array.isArray(res) ? res : [];
        }
    });

    // Fetch active vendors for dropdown
    const { data: vendors = [] } = useQuery<VendorType[]>({
        queryKey: ['active-vendors-for-po'],
        queryFn: async () => {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    });

    // Select all items initially
    useEffect(() => {
        if (forecast.length > 0) {
            setSelectedItemIds(forecast.map(f => f.itemId));
        }
    }, [forecast]);

    // Mutation: Create Draft PO
    const createDraftPOMutation = useMutation({
        mutationFn: async (payload: {
            projectId: string;
            vendorId: string;
            title: string;
            items: Array<{ itemCode: string; description: string; unit: string; quantity: number; unitPrice: number }>;
        }) => {
            const res = await fetch('/api/procurement/forecast/create-po', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to create Draft PO');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Draft Purchase Order created successfully!');
            setShowPODialog(false);
            setPoTitle('');
            setSelectedProjectId('');
            setSelectedVendorId('');
            queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Error generating Draft PO');
        }
    });

    const handleSelectAll = () => {
        if (selectedItemIds.length === forecast.length) {
            setSelectedItemIds([]);
        } else {
            setSelectedItemIds(forecast.map(f => f.itemId));
        }
    };

    const handleToggleItem = (itemId: string) => {
        setSelectedItemIds(prev => 
            prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
        );
    };

    const handleOpenPODialog = () => {
        if (selectedItemIds.length === 0) {
            toast.warning('Please select at least one material to include in the PO.');
            return;
        }
        setPoTitle(`AI Projected Materials Reorder - ${new Date().toLocaleDateString()}`);
        setShowPODialog(true);
    };

    const handleGeneratePO = () => {
        if (!selectedProjectId || !selectedVendorId || !poTitle) {
            toast.error('Project, Vendor, and Title are required.');
            return;
        }

        const poItems = forecast
            .filter(f => selectedItemIds.includes(f.itemId))
            .map(f => ({
                itemCode: f.itemCode,
                description: f.itemName,
                unit: f.unit,
                quantity: f.recommendedQty,
                unitPrice: f.unitPrice
            }));

        createDraftPOMutation.mutate({
            projectId: selectedProjectId,
            vendorId: selectedVendorId,
            title: poTitle,
            items: poItems
        });
    };

    const totalRecommendedCost = forecast
        .filter(f => selectedItemIds.includes(f.itemId))
        .reduce((sum, f) => sum + f.projectedCost, 0);

    const formattedCost = new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 0
    }).format(totalRecommendedCost);

    return (
        <div className="flex h-screen bg-[#0F172A] text-slate-100 font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                <Header />
                <main className="p-6 space-y-6">
                    <div className="space-y-0.5">
                        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-400" />
                            AI Procurement & Expiry Monitor
                        </h1>
                        <p className="text-xs text-slate-400">Run predictive demand models, create Draft Purchase Orders, and monitor expiring batches.</p>
                    </div>

                    <Tabs defaultValue="forecast" className="w-full">
                        <TabsList className="bg-[#1E293B] border-slate-700/50 p-0.5 rounded-lg max-w-[400px]">
                            <TabsTrigger value="forecast" className="text-xs data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                                Demand Forecasting
                            </TabsTrigger>
                            <TabsTrigger value="expiry" className="text-xs data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                Expiry Alerts ({warnings.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* DEMAND FORECAST TAB */}
                        <TabsContent value="forecast" className="space-y-6 mt-4">
                            {/* Forecast Parameters Configuration */}
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                <Card className="bg-[#1E293B] border-slate-700/50 p-4 lg:col-span-3">
                                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wide">Predictive Forecasting Parameters</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Forecast Horizon</label>
                                            <select 
                                                className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-1.5 outline-none cursor-pointer"
                                                value={months}
                                                onChange={e => setMonths(parseInt(e.target.value))}
                                            >
                                                <option value={1}>Next 1 Month Projections</option>
                                                <option value={2}>Next 2 Months Projections</option>
                                                <option value={3}>Next 3 Months Projections</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Connection/FTTH Target (monthly)</label>
                                            <input 
                                                type="number"
                                                className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-100 rounded p-1.5 outline-none font-mono"
                                                value={target}
                                                onChange={e => setTarget(parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <Button 
                                                className="w-full bg-sky-600 hover:bg-sky-700 text-xs gap-1.5 h-9"
                                                onClick={() => refetchForecast()}
                                                disabled={isLoadingForecast}
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingForecast ? 'animate-spin' : ''}`} />
                                                Recalculate AI Model
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="bg-[#1E293B] border-slate-700/50 p-4 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Total Recommended Order Value</h3>
                                        <span className="text-lg font-bold font-mono text-emerald-400">{formattedCost}</span>
                                    </div>
                                    <Button 
                                        className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-xs w-full gap-1.5"
                                        onClick={handleOpenPODialog}
                                        disabled={selectedItemIds.length === 0}
                                    >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        Generate Draft PO
                                    </Button>
                                </Card>
                            </div>

                            {/* Shortage Forecast Directory */}
                            <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                                <CardHeader className="border-b border-slate-700/50 pb-4 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-bold text-slate-300">Material Shortage Projections & Reorder Recommendations</CardTitle>
                                        <CardDescription className="text-[11px] text-slate-500">Predicted shortfall includes average consumption + project targets against current stock.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {isLoadingForecast ? (
                                        <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                                            Evaluating stock levels and forecasting demands...
                                        </div>
                                    ) : forecast.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">
                                            All materials have sufficient stock to cover the forecast horizon. No shortages detected!
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#0F172A] text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-700/50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-center w-10">
                                                            <button onClick={handleSelectAll} className="text-slate-400 hover:text-white">
                                                                {selectedItemIds.length === forecast.length ? (
                                                                    <CheckSquare className="w-4 h-4" />
                                                                ) : (
                                                                    <Square className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </th>
                                                        <th className="px-4 py-3">Item details</th>
                                                        <th className="px-4 py-3 text-right">In Hand</th>
                                                        <th className="px-4 py-3 text-right">Avg Monthly Cons.</th>
                                                        <th className="px-4 py-3 text-right">Target Demand</th>
                                                        <th className="px-4 py-3 text-right">Total Horizon Req</th>
                                                        <th className="px-4 py-3 text-right">Predicted Shortfall</th>
                                                        <th className="px-4 py-3 text-right font-bold text-emerald-400">Reorder Qty (+10%)</th>
                                                        <th className="px-4 py-3 text-right">Unit Price</th>
                                                        <th className="px-4 py-3 text-right">Projected Cost</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50 font-mono">
                                                    {forecast.map((item) => {
                                                        const isSelected = selectedItemIds.includes(item.itemId);
                                                        return (
                                                            <tr 
                                                                key={item.itemId} 
                                                                className={`hover:bg-slate-800/20 transition-colors ${isSelected ? 'bg-slate-800/10' : ''}`}
                                                            >
                                                                <td className="px-4 py-3 text-center">
                                                                    <button 
                                                                        onClick={() => handleToggleItem(item.itemId)} 
                                                                        className="text-slate-400 hover:text-white"
                                                                    >
                                                                        {isSelected ? (
                                                                            <CheckSquare className="w-4 h-4 text-sky-400" />
                                                                        ) : (
                                                                            <Square className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3 font-sans">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-slate-100">{item.itemName}</span>
                                                                        <span className="text-[10px] text-slate-500 font-mono">{item.itemCode} ({item.unit})</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-slate-200">{item.currentStock}</td>
                                                                <td className="px-4 py-3 text-right text-slate-300">{item.avgMonthlyConsumption}</td>
                                                                <td className="px-4 py-3 text-right text-slate-300">{item.targetMonthlyDemand}</td>
                                                                <td className="px-4 py-3 text-right text-slate-200">{item.predictedDemand}</td>
                                                                <td className="px-4 py-3 text-right text-rose-400 font-semibold">{item.shortfall}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-emerald-400">{item.recommendedQty}</td>
                                                                <td className="px-4 py-3 text-right text-slate-300">Rs.{item.unitPrice}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-100">
                                                                    Rs.{item.projectedCost.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* EXPIRY ALERTS TAB */}
                        <TabsContent value="expiry" className="space-y-6 mt-4">
                            <Card className="bg-[#1E293B] border-slate-700/50 p-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-9 h-9 text-rose-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-200">Critical Batch Expirations & FEFO Compliance</h3>
                                            <p className="text-xs text-slate-400">Stores assistants must pick materials from the oldest batches (earliest expiry date) first to minimize inventory wastage.</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-9 gap-1.5"
                                        onClick={() => refetchExpiry()}
                                        disabled={isLoadingExpiry}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingExpiry ? 'animate-spin' : ''}`} />
                                        Scan Expiring Batches
                                    </Button>
                                </div>
                            </Card>

                            <Card className="bg-[#1E293B] border-slate-700/50 shadow-md">
                                <CardContent className="p-0">
                                    {isLoadingExpiry ? (
                                        <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                                            Scanning batch stock levels...
                                        </div>
                                    ) : warnings.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">
                                            No batches are close to expiry (within 30 days) with remaining stock.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-[#0F172A] text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-700/50">
                                                    <tr>
                                                        <th className="px-4 py-3">Batch Number</th>
                                                        <th className="px-4 py-3">Material Name</th>
                                                        <th className="px-4 py-3">Store location</th>
                                                        <th className="px-4 py-3 text-right">Remaining quantity</th>
                                                        <th className="px-4 py-3">Expiry Date</th>
                                                        <th className="px-4 py-3 text-right">Alert status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50">
                                                    {warnings.map((warning, idx) => {
                                                        const expiry = new Date(warning.expiryDate);
                                                        const diffDays = Math.ceil((expiry.getTime() - new Date().getTime()) / 86400000);
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-800/20 transition-colors font-mono">
                                                                <td className="px-4 py-3.5 font-bold text-slate-100">{warning.batchNumber}</td>
                                                                <td className="px-4 py-3.5 font-sans font-medium text-slate-200">{warning.itemName}</td>
                                                                <td className="px-4 py-3.5 font-sans text-slate-300">{warning.storeName}</td>
                                                                <td className="px-4 py-3.5 text-right font-bold text-slate-200">{warning.quantity}</td>
                                                                <td className="px-4 py-3.5 text-rose-400 font-semibold">{expiry.toLocaleDateString()}</td>
                                                                <td className="px-4 py-3.5 text-right">
                                                                    <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px]">
                                                                        Expires in {diffDays} days
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>

            {/* DRAFT PO GENERATION DIALOG */}
            <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
                <DialogContent className="bg-[#1E293B] border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Generate Draft Purchase Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 text-xs">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Purchase Order Title</label>
                            <input 
                                type="text"
                                className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-100 rounded p-2 outline-none font-sans"
                                value={poTitle}
                                onChange={e => setPoTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Target Project</label>
                            <select 
                                className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none cursor-pointer"
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">Choose Project...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Recommended Vendor</label>
                            <select 
                                className="w-full mt-1 bg-[#0F172A] border border-slate-700 text-sm text-slate-300 rounded p-2 outline-none cursor-pointer"
                                value={selectedVendorId}
                                onChange={e => setSelectedVendorId(e.target.value)}
                            >
                                <option value="">Choose Vendor...</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="p-3 bg-[#0F172A] rounded border border-slate-700 space-y-1 font-sans">
                            <p className="text-slate-400"><span className="font-bold">Total Items to order:</span> {selectedItemIds.length}</p>
                            <p className="text-slate-400"><span className="font-bold">Estimated Cost (LKR):</span> {formattedCost}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowPODialog(false)}>Cancel</Button>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700" 
                            onClick={handleGeneratePO} 
                            disabled={createDraftPOMutation.isPending}
                        >
                            {createDraftPOMutation.isPending ? 'Generating PO...' : 'Compile & Save Draft'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
