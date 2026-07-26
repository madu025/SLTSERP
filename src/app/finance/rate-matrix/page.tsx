"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Save, DollarSign, MapPin, Calculator, ShieldCheck, Check } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';

interface RateRule {
    id: string;
    workType: string;
    workDescription: string;
    minDistance: number;
    maxDistance: number;
    areaGroup: 'CEN' | 'HK' | 'OTHER';
    rateAmount: number;
    poleType?: string | null;
    poleMethod?: string | null;
    isActive: boolean;
}

interface GroupedWorkRow {
    workDescription: string;
    workType: string;
    cenRule?: RateRule;
    hkRule?: RateRule;
    otherRule?: RateRule;
}

export default function DynamicRateMatrixPage() {
    const [rules, setRules] = useState<RateRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/rate-matrix');
            if (res.ok) {
                const data = await res.json();
                setRules(data.rules || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    // Group rules by workDescription
    const groupedMap = new Map<string, GroupedWorkRow>();
    for (const r of rules) {
        let entry = groupedMap.get(r.workDescription);
        if (!entry) {
            entry = { workDescription: r.workDescription, workType: r.workType };
            groupedMap.set(r.workDescription, entry);
        }
        if (r.areaGroup === 'CEN') entry.cenRule = r;
        if (r.areaGroup === 'HK') entry.hkRule = r;
        if (r.areaGroup === 'OTHER') entry.otherRule = r;
    }

    const groupedRows = Array.from(groupedMap.values());

    const handleRateChange = (ruleId: string, newAmount: number) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, rateAmount: newAmount } : r));
    };

    const handleSaveRate = async (ruleId: string, rateAmount: number) => {
        setSavingId(ruleId);
        try {
            const res = await fetch('/api/admin/rate-matrix', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ruleId, rateAmount })
            });

            if (res.ok) {
                setSavedId(ruleId);
                setTimeout(() => setSavedId(null), 2000);
            } else {
                alert('Failed to update rate amount');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating rate');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER']}>
            <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    <Header />

                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                        {/* Page Header */}
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-blue-600 text-white font-mono text-[10px] uppercase">
                                        DYNAMIC INVOICING CONFIG
                                    </Badge>
                                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                                        ZERO HARDCODED RATES
                                    </Badge>
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                                    <Calculator className="w-6 h-6 text-blue-400" />
                                    Contractor Invoicing Dynamic Rate Matrix
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Configure billable contractor rates dynamically by Work Category, Region (CEN, HK, OTHER), and DW Distance.
                                </p>
                            </div>

                            <Button onClick={fetchRules} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2 text-xs">
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Matrix
                            </Button>
                        </div>

                        {/* Region Legends */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <Card className="bg-slate-800/80 border-slate-700 text-white p-4">
                                <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">CEN Region Rate</p>
                                <p className="text-xs text-slate-300 mt-1 font-medium">Colombo Central & Metro 01 OPMCs</p>
                            </Card>
                            <Card className="bg-slate-800/80 border-slate-700 text-white p-4">
                                <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">HK Region Rate</p>
                                <p className="text-xs text-slate-300 mt-1 font-medium">Homagama, Hanwella & Kaduwela OPMCs</p>
                            </Card>
                            <Card className="bg-slate-800/80 border-slate-700 text-white p-4">
                                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">OTHER Region Rate</p>
                                <p className="text-xs text-slate-300 mt-1 font-medium">All Regional Outstation RTOM Areas</p>
                            </Card>
                        </div>

                        {/* Rate Matrix Table */}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-700">
                                        <tr>
                                            <th className="py-3 px-4 w-12">#</th>
                                            <th className="py-3 px-4">WORK DESCRIPTION</th>
                                            <th className="py-3 px-4 w-28 text-center">TYPE</th>
                                            <th className="py-3 px-4 w-44 text-right text-blue-400 bg-blue-950/20">CEN (LKR)</th>
                                            <th className="py-3 px-4 w-44 text-right text-amber-400 bg-amber-950/20">HK (LKR)</th>
                                            <th className="py-3 px-4 w-44 text-right text-emerald-400 bg-emerald-950/20">OTHER (LKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/60 bg-slate-800/50">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                                                    <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                                    Loading Rate Matrix...
                                                </td>
                                            </tr>
                                        ) : groupedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-400">
                                                    No rate rules found. Run seeding to populate.
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedRows.map((row, idx) => (
                                                <tr key={row.workDescription} className="hover:bg-slate-700/40 transition-colors">
                                                    <td className="py-3 px-4 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                    <td className="py-3 px-4 font-bold text-white tracking-wide">
                                                        {row.workDescription}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge className="bg-slate-700 text-slate-300 font-mono text-[9px] px-2 py-0.5">
                                                            {row.workType}
                                                        </Badge>
                                                    </td>

                                                    {/* CEN Cell */}
                                                    <td className="py-2 px-3 text-right bg-blue-950/10">
                                                        {row.cenRule ? (
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Input
                                                                    type="number"
                                                                    value={row.cenRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.cenRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="h-8 w-24 text-right font-mono font-bold text-blue-300 bg-slate-900 border-slate-700 text-xs px-2"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveRate(row.cenRule!.id, row.cenRule!.rateAmount)}
                                                                    className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                                                                    title="Save CEN Rate"
                                                                >
                                                                    {savedId === row.cenRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-slate-600 font-mono">-</span>}
                                                    </td>

                                                    {/* HK Cell */}
                                                    <td className="py-2 px-3 text-right bg-amber-950/10">
                                                        {row.hkRule ? (
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Input
                                                                    type="number"
                                                                    value={row.hkRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.hkRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="h-8 w-24 text-right font-mono font-bold text-amber-300 bg-slate-900 border-slate-700 text-xs px-2"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveRate(row.hkRule!.id, row.hkRule!.rateAmount)}
                                                                    className="h-8 w-8 p-0 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                                                                    title="Save HK Rate"
                                                                >
                                                                    {savedId === row.hkRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-slate-600 font-mono">-</span>}
                                                    </td>

                                                    {/* OTHER Cell */}
                                                    <td className="py-2 px-3 text-right bg-emerald-950/10">
                                                        {row.otherRule ? (
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Input
                                                                    type="number"
                                                                    value={row.otherRule.rateAmount}
                                                                    onChange={(e) => handleRateChange(row.otherRule!.id, parseFloat(e.target.value) || 0)}
                                                                    className="h-8 w-24 text-right font-mono font-bold text-emerald-300 bg-slate-900 border-slate-700 text-xs px-2"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveRate(row.otherRule!.id, row.otherRule!.rateAmount)}
                                                                    className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                                                    title="Save OTHER Rate"
                                                                >
                                                                    {savedId === row.otherRule.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </div>
                                                        ) : <span className="text-slate-600 font-mono">-</span>}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
