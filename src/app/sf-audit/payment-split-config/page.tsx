"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, PieChart, Info } from 'lucide-react';

function SFAuditPaymentSplitConfigContent() {
    const [splitMode, setSplitMode] = useState<'SINGLE_FULL' | 'SPLIT_AB' | 'SPLIT_ABC'>('SPLIT_AB');
    const [claimAPercent, setClaimAPercent] = useState<number>(90);
    const [claimBPercent, setClaimBPercent] = useState<number>(10);
    const [claimCPercent, setClaimCPercent] = useState<number>(0);
    const [description, setDescription] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/finance/sf-audit/payment-split-config');
            if (res.ok) {
                const json = await res.json();
                if (json.data) {
                    setSplitMode(json.data.splitMode || 'SPLIT_AB');
                    setClaimAPercent(json.data.claimAPercent ?? 90);
                    setClaimBPercent(json.data.claimBPercent ?? 10);
                    setClaimCPercent(json.data.claimCPercent ?? 0);
                    setDescription(json.data.description || '');
                }
            }
        } catch (err) {
            console.error(err);
            setNotice({ type: 'error', message: 'Failed to load SF Audit payment split config' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const totalPercent = claimAPercent + claimBPercent + claimCPercent;
    const isValid = Math.abs(totalPercent - 100) < 0.01;

    const handleApplyPreset = (mode: 'SINGLE_FULL' | 'SPLIT_AB' | 'SPLIT_ABC', a: number, b: number, c: number, desc: string) => {
        setSplitMode(mode);
        setClaimAPercent(a);
        setClaimBPercent(b);
        setClaimCPercent(c);
        setDescription(desc);
    };

    const handleSave = async () => {
        if (!isValid) {
            setNotice({ type: 'error', message: `Total split percentage must equal exactly 100%. Current total: ${totalPercent}%` });
            return;
        }

        setSaving(true);
        setNotice(null);

        try {
            const res = await fetch('/api/finance/sf-audit/payment-split-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    splitMode,
                    claimAPercent,
                    claimBPercent,
                    claimCPercent,
                    description
                })
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setNotice({ type: 'success', message: 'SF Audit Payment Split Rule successfully updated in Database!' });
            } else {
                throw new Error(json.error || 'Failed to save configuration');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save configuration';
            setNotice({ type: 'error', message: msg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER', 'INVOICE_MANAGER', 'MANAGER']}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-blue-600 text-white font-mono text-xs">SF AUDIT GOVERNANCE</Badge>
                                        <Badge variant="outline" className="text-slate-600 border-slate-300">DYNAMIC RULE CONFIGURATOR</Badge>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                        Contractor Invoice Payment Split Configurator
                                    </h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        SF Auditor rule center to dynamically configure Contractor Claim A, B, C percentages or Full Invoice payouts without hardcoding.
                                    </p>
                                </div>

                                <Button onClick={fetchConfig} variant="outline" size="sm" className="gap-2 self-start md:self-auto">
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Rules
                                </Button>
                            </div>

                            {/* Notice Alert */}
                            {notice && (
                                <div className={`p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium border ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
                                    <div className="flex items-center gap-2">
                                        {notice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
                                        <span>{notice.message}</span>
                                    </div>
                                    <button onClick={() => setNotice(null)} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
                                </div>
                            )}

                            {/* Rule Selection Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Mode 1: Single 100% Invoice */}
                                <Card 
                                    className={`cursor-pointer transition-all border-2 ${splitMode === 'SINGLE_FULL' ? 'border-blue-600 bg-blue-50/40 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => handleApplyPreset('SINGLE_FULL', 100, 0, 0, '100% Full Payment Claim (No Split)')}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-slate-800 text-white text-[10px]">MODE 1</Badge>
                                            {splitMode === 'SINGLE_FULL' && <ShieldCheck className="w-5 h-5 text-blue-600" />}
                                        </div>
                                        <CardTitle className="text-base font-bold mt-2">Full Invoice (100%)</CardTitle>
                                        <CardDescription className="text-xs">No payment splits. 100% of the SOD claim paid in a single invoice cycle.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-black font-mono text-blue-700">100% Claim</div>
                                    </CardContent>
                                </Card>

                                {/* Mode 2: Split A & B */}
                                <Card 
                                    className={`cursor-pointer transition-all border-2 ${splitMode === 'SPLIT_AB' ? 'border-emerald-600 bg-emerald-50/40 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => {
                                        if (splitMode !== 'SPLIT_AB') {
                                            handleApplyPreset('SPLIT_AB', 90, 10, 0, 'Standard 90% Direct Labor Claim A & 10% Material Supply Claim B');
                                        }
                                    }}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-emerald-700 text-white text-[10px]">MODE 2 (DEFAULT)</Badge>
                                            {splitMode === 'SPLIT_AB' && <ShieldCheck className="w-5 h-5 text-emerald-600" />}
                                        </div>
                                        <CardTitle className="text-base font-bold mt-2">Split Claim A & B</CardTitle>
                                        <CardDescription className="text-xs">Splits claim into Direct Labor (Claim A) & Material Supply/Retention (Claim B).</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-black font-mono text-emerald-700">A: {claimAPercent}% / B: {claimBPercent}%</div>
                                    </CardContent>
                                </Card>

                                {/* Mode 3: Split A, B & C */}
                                <Card 
                                    className={`cursor-pointer transition-all border-2 ${splitMode === 'SPLIT_ABC' ? 'border-purple-600 bg-purple-50/40 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => {
                                        if (splitMode !== 'SPLIT_ABC') {
                                            handleApplyPreset('SPLIT_ABC', 80, 10, 10, '3-Way Split: 80% Claim A, 10% Claim B, 10% Claim C Retention');
                                        }
                                    }}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-purple-700 text-white text-[10px]">MODE 3</Badge>
                                            {splitMode === 'SPLIT_ABC' && <ShieldCheck className="w-5 h-5 text-purple-600" />}
                                        </div>
                                        <CardTitle className="text-base font-bold mt-2">Split Claim A, B & C</CardTitle>
                                        <CardDescription className="text-xs">3-Way split including Labor (A), Material (B), and Quality Retention (C).</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xl font-black font-mono text-purple-700">A: {claimAPercent}% / B: {claimBPercent}% / C: {claimCPercent}%</div>
                                    </CardContent>
                                </Card>

                            </div>

                            {/* Quick Presets & Interactive Percentage Tuner */}
                            <Card className="border border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PieChart className="w-5 h-5 text-blue-600" />
                                            <CardTitle className="text-lg font-bold">Interactive Percentage Tuner</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="font-semibold text-slate-600">Quick Presets:</span>
                                            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => handleApplyPreset('SPLIT_AB', 90, 10, 0, 'Standard SF Audit 90% / 10% Rule')}>
                                                90% / 10%
                                            </Button>
                                            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => handleApplyPreset('SPLIT_AB', 70, 30, 0, 'Classic OSP 70% / 30% Rule')}>
                                                70% / 30%
                                            </Button>
                                            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => handleApplyPreset('SINGLE_FULL', 100, 0, 0, '100% Full Payment Claim')}>
                                                100% Full
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-6">

                                    {/* Visual Allocation Bar */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                            <span>Visual Allocation Split</span>
                                            <span className={isValid ? 'text-emerald-600 font-mono' : 'text-rose-600 font-mono font-bold'}>
                                                Total: {totalPercent}% {isValid ? '(Valid 100%)' : '(Must equal 100%)'}
                                            </span>
                                        </div>
                                        
                                        <div className="h-6 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner border border-slate-200">
                                            <div style={{ width: `${claimAPercent}%` }} className="bg-emerald-500 flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all">
                                                {claimAPercent > 5 ? `Claim A (${claimAPercent}%)` : ''}
                                            </div>
                                            <div style={{ width: `${claimBPercent}%` }} className="bg-amber-500 flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all">
                                                {claimBPercent > 5 ? `Claim B (${claimBPercent}%)` : ''}
                                            </div>
                                            <div style={{ width: `${claimCPercent}%` }} className="bg-purple-500 flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all">
                                                {claimCPercent > 5 ? `Claim C (${claimCPercent}%)` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sliders & Numeric Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        
                                        {/* Claim A */}
                                        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold text-emerald-900">Claim A (Direct Labor)</Label>
                                                <span className="font-mono font-black text-lg text-emerald-700">{claimAPercent}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={claimAPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setClaimAPercent(val);
                                                    if (splitMode === 'SPLIT_AB') {
                                                        setClaimBPercent(100 - val);
                                                        setClaimCPercent(0);
                                                    }
                                                }}
                                                className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-200 rounded-lg"
                                            />
                                            <Input
                                                type="number"
                                                value={claimAPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimAPercent(parseFloat(e.target.value) || 0)}
                                                className="font-mono bg-white"
                                            />
                                        </div>

                                        {/* Claim B */}
                                        <div className={`p-4 rounded-xl border space-y-3 ${splitMode === 'SINGLE_FULL' ? 'opacity-40 pointer-events-none bg-slate-50 border-slate-200' : 'bg-amber-50/50 border-amber-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold text-amber-900">Claim B (Material Supply)</Label>
                                                <span className="font-mono font-black text-lg text-amber-700">{claimBPercent}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={claimBPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setClaimBPercent(val);
                                                    if (splitMode === 'SPLIT_AB') {
                                                        setClaimAPercent(100 - val);
                                                        setClaimCPercent(0);
                                                    }
                                                }}
                                                className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200 rounded-lg"
                                            />
                                            <Input
                                                type="number"
                                                value={claimBPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimBPercent(parseFloat(e.target.value) || 0)}
                                                className="font-mono bg-white"
                                            />
                                        </div>

                                        {/* Claim C */}
                                        <div className={`p-4 rounded-xl border space-y-3 ${splitMode !== 'SPLIT_ABC' ? 'opacity-40 pointer-events-none bg-slate-50 border-slate-200' : 'bg-purple-50/50 border-purple-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <Label className="font-bold text-purple-900">Claim C (Quality Retention)</Label>
                                                <span className="font-mono font-black text-lg text-purple-700">{claimCPercent}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={claimCPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimCPercent(parseFloat(e.target.value) || 0)}
                                                className="w-full accent-purple-600 cursor-pointer h-2 bg-purple-200 rounded-lg"
                                            />
                                            <Input
                                                type="number"
                                                value={claimCPercent}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClaimCPercent(parseFloat(e.target.value) || 0)}
                                                className="font-mono bg-white"
                                            />
                                        </div>

                                    </div>

                                    {/* Rule Description Note */}
                                    <div className="space-y-2 pt-2">
                                        <Label className="font-bold text-slate-800">Rule Description & Audit Reference Note</Label>
                                        <Input
                                            placeholder="e.g. Configured by SF Audit Executive Committee - Effective July 2026"
                                            value={description}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                                            className="bg-slate-50 text-slate-800"
                                        />
                                    </div>

                                    {/* Save Button */}
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Info className="w-4 h-4 text-blue-500" />
                                            <span>This rule immediately applies to all newly generated and viewed contractor invoices across the ERP platform.</span>
                                        </div>

                                        <Button 
                                            onClick={handleSave} 
                                            disabled={saving || !isValid} 
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 px-6 shadow-md"
                                        >
                                            <Save className="w-4 h-4" />
                                            {saving ? 'Persisting Rule...' : 'Save SF Audit Rule to Database'}
                                        </Button>
                                    </div>

                                </CardContent>
                            </Card>
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function SFAuditPaymentSplitConfigPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen bg-slate-50 items-center justify-center font-sans">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        }>
            <SFAuditPaymentSplitConfigContent />
        </Suspense>
    );
}
