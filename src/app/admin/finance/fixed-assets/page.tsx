"use client";

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/sidebar-menu';
import { Badge } from "@/components/ui/badge";
import { Package, Play, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FixedAsset {
    id: string;
    assetNumber: string;
    name: string;
    category: string;
    cost: number;
    usefulLifeYears: number;
    accumulatedDepreciation: number;
    netBookValue: number;
    status: string;
    acquisitionDate: string;
}

interface AssetRegisterData {
    totalCost: number;
    totalAccumulatedDepreciation: number;
    totalNetBookValue: number;
    activeCount: number;
    assets: FixedAsset[];
}

export default function FixedAssetsPage() {
    const queryClient = useQueryClient();
    const [isRunningDep, setIsRunningDep] = useState<boolean>(false);

    const { data, isLoading } = useQuery<AssetRegisterData>({
        queryKey: ['fixed-assets-register'],
        queryFn: async () => {
            const res = await fetch(`/api/finance/fixed-assets?_t=${Date.now()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch Fixed Asset Register');
            return json.data;
        }
    });

    const handleRunDepreciation = async () => {
        setIsRunningDep(true);
        try {
            const now = new Date();
            const res = await fetch('/api/finance/fixed-assets/depreciate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: now.getFullYear(),
                    month: now.getMonth() + 1
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to run depreciation');
            toast.success(`Monthly depreciation run complete! Charged LKR ${json.data.batchDepreciationTotal.toLocaleString()}`);
            queryClient.invalidateQueries({ queryKey: ['fixed-assets-register'] });
        } catch (err: any) {
            toast.error(err.message || 'Failed to execute depreciation run');
        } finally {
            setIsRunningDep(false);
        }
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.FINANCE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Title & Action */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <Package className="w-7 h-7 text-indigo-600" />
                                    Fixed Asset Register & Depreciation
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Capitalized fixed assets, accumulated depreciation, net book value, and monthly depreciation runs.
                                </p>
                            </div>

                            <Button onClick={handleRunDepreciation} disabled={isRunningDep} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                                <Play className="w-4 h-4 mr-2" />
                                {isRunningDep ? 'Executing Run...' : 'Run Monthly Depreciation'}
                            </Button>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Total Asset Cost</div>
                                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                                    LKR {(data?.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-rose-700">Accumulated Depreciation</div>
                                <div className="text-xl font-bold text-rose-900 mt-1 font-mono">
                                    LKR {(data?.totalAccumulatedDepreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                                <div className="text-xs font-semibold uppercase text-emerald-800">Net Book Value (NBV)</div>
                                <div className="text-xl font-bold text-emerald-950 mt-1 font-mono">
                                    LKR {(data?.totalNetBookValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                                <div className="text-xs font-semibold uppercase text-slate-500">Active Capitalized Assets</div>
                                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                                    {data?.activeCount || 0} Assets
                                </div>
                            </div>
                        </div>

                        {/* Fixed Asset Register Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading Fixed Asset Register...</div>
                            ) : (data?.assets.length || 0) === 0 ? (
                                <div className="p-8 text-center text-slate-500">No fixed assets registered.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                                                <th className="py-3.5 px-4">Asset Code</th>
                                                <th className="py-3.5 px-4">Asset Description</th>
                                                <th className="py-3.5 px-4">Category</th>
                                                <th className="py-3.5 px-4 text-right">Cost (LKR)</th>
                                                <th className="py-3.5 px-4 text-right">Accumulated Dep. (LKR)</th>
                                                <th className="py-3.5 px-4 text-right">Net Book Value (LKR)</th>
                                                <th className="py-3.5 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {data?.assets.map((asset) => (
                                                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-900">{asset.assetNumber}</td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-900">{asset.name}</td>
                                                    <td className="py-3.5 px-4">
                                                        <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                                                        LKR {asset.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-medium text-rose-700">
                                                        LKR {asset.accumulatedDepreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                                                        LKR {asset.netBookValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <Badge className={asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}>
                                                            {asset.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
