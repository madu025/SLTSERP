'use client';
import { ROLE_GROUPS } from '@/config/roles';

import {  useState, useEffect  } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, FileText, CheckCircle, Calculator } from 'lucide-react';
import { useRouter } from 'next/navigation';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);

export default function ContractorBillingPage() {
    const [contractors, setContractors] = useState<any[]>([]);
    const [selectedContractor, setSelectedContractor] = useState<string>('');
    const [unbilledSods, setUnbilledSods] = useState<any[]>([]);
    const [grossAmount, setGrossAmount] = useState(0);
    const [retentionPercent, setRetentionPercent] = useState(5);
    const [whtPercent, setWhtPercent] = useState(5);
    const [advanceDeduction, setAdvanceDeduction] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/contractors')
            .then(res => res.json())
            .then(data => {
                if (data.success) setContractors(data.data.contractors || data.data || []);
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!selectedContractor) {
            setUnbilledSods([]);
            setGrossAmount(0);
            return;
        }

        setIsLoading(true);
        fetch(`/api/finance/unbilled-sods?contractorId=${selectedContractor}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setUnbilledSods(data.data.sods);
                    setGrossAmount(data.data.totalAmount);
                } else {
                    toast.error(data.error || 'Error fetching SODs');
                }
            })
            .catch(err => toast.error((err instanceof Error ? err.message : "Unknown error")))
            .finally(() => setIsLoading(false));
    }, [selectedContractor]);

    const retentionAmount = (grossAmount * retentionPercent) / 100;
    const whtAmount = (grossAmount * whtPercent) / 100;
    const netPayout = grossAmount - retentionAmount - whtAmount - advanceDeduction;

    const handleGenerateInvoice = async () => {
        if (!selectedContractor) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/finance/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorId: selectedContractor,
                    retentionPercent,
                    whtPercent,
                    advanceDeduction
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Draft invoice generated successfully!');
                setUnbilledSods([]);
                setGrossAmount(0);
                setTimeout(() => router.push('/finance/invoices'), 1500);
            } else {
                toast.error(data.error || 'Generation failed');
            }
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <RoleGuard allowedRoles={ROLE_GROUPS.PROJECT_MANAGERS}>
            <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                        <div className="max-w-6xl mx-auto space-y-8">
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contractor Billing</h1>
                                    <p className="text-slate-500 mt-1">Generate settlement invoices for completed work.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="lg:col-span-2 shadow-sm border-slate-200/60 overflow-hidden">
                                    <CardHeader className="bg-white border-b border-slate-100">
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-indigo-500" />
                                            Billing Configuration
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6 bg-white">
                                        <div className="space-y-3">
                                            <Label>Select Contractor</Label>
                                            <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a contractor..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {contractors.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-3">
                                                <Label>Retention Fund (%)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={retentionPercent} 
                                                    onChange={e => setRetentionPercent(Number(e.target.value))}
                                                    min={0} max={100}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label>WHT Deduction (%)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={whtPercent} 
                                                    onChange={e => setWhtPercent(Number(e.target.value))}
                                                    min={0} max={100}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label>Advance Recovery (LKR)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={advanceDeduction} 
                                                    onChange={e => setAdvanceDeduction(Number(e.target.value))}
                                                    min={0}
                                                />
                                            </div>
                                        </div>

                                        {isLoading ? (
                                            <div className="flex justify-center items-center py-12">
                                                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                                            </div>
                                        ) : selectedContractor && unbilledSods.length > 0 ? (
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                                                <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 flex justify-between items-center">
                                                    <span className="font-medium text-slate-700">Eligible SODs for Billing</span>
                                                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                                        {unbilledSods.length} Records
                                                    </span>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3">SO Number</th>
                                                                <th className="px-4 py-3">Completed Date</th>
                                                                <th className="px-4 py-3 text-right">Amount (LKR)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {unbilledSods.map(sod => (
                                                                <tr key={sod.id} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-4 py-3 font-medium text-slate-900">{sod.soNum}</td>
                                                                    <td className="px-4 py-3 text-slate-500">{new Date(sod.completedDate).toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(sod.contractorAmount || 0)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : selectedContractor ? (
                                            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                                <CheckCircle className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                                                <p>All completed SODs have been billed.</p>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border-slate-200/60 bg-gradient-to-b from-slate-900 to-slate-950 text-white overflow-hidden">
                                    <CardHeader className="border-b border-slate-800">
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <Calculator className="h-5 w-5 text-indigo-400" />
                                            Settlement Summary
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400">Gross Payout</span>
                                                <span className="font-medium">{formatCurrency(grossAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-red-400">
                                                <span>Retention ({retentionPercent}%)</span>
                                                <span>- {formatCurrency(retentionAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-red-400">
                                                <span>WHT ({whtPercent}%)</span>
                                                <span>- {formatCurrency(whtAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-red-400">
                                                <span>Advances</span>
                                                <span>- {formatCurrency(advanceDeduction)}</span>
                                            </div>
                                            <div className="pt-4 border-t border-slate-800">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-slate-300 font-medium">Net Payable</span>
                                                    <span className="text-2xl font-bold text-emerald-400 tracking-tight">
                                                        {formatCurrency(netPayout)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button 
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20"
                                            size="lg"
                                            disabled={!selectedContractor || unbilledSods.length === 0 || isGenerating}
                                            onClick={handleGenerateInvoice}
                                        >
                                            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                            {isGenerating ? 'Generating...' : 'Generate Draft Invoice'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
