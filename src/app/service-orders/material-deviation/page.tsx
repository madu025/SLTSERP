"use client";
import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { toErrorText } from '@/lib/error-text';

interface Line { type: string; label: string; reportedQty: number; manualQty: number; wastageQty: number; difference: number }
interface Order { id: string; soNum: string; status: string; rtom: string | null; contractor: string | null; lines: Line[] }
interface Report {
    summary: { ordersCompared: number; ordersWithDeviation: number; qtyMismatch: number; notEntered: number; notReported: number; unmapped: number };
    byContractor: { contractor: string; orders: number; deviating: number; deviationRate: number }[];
    orders: Order[];
}

const TYPE_LABEL: Record<string, string> = {
    QTY_MISMATCH: 'Quantity differs',
    NOT_ENTERED: 'SLT reported, not entered',
    NOT_REPORTED: 'Entered, not reported by SLT',
    UNMAPPED: 'SLT item not mapped',
    MATCH: 'Match',
};

export default function MaterialDeviationPage() {
    const [data, setData] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/service-orders/material-deviation');
            const json = await res.json();
            if (!res.ok) throw new Error(toErrorText(json?.error ?? json) || 'Unable to load the deviation report');
            setData(json?.data ?? json);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load the deviation report');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    return (
        <RoleGuard permissionId={RBAC_PERMISSIONS.SOD_INVOICE}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
                            <div className="flex items-start justify-between gap-4 border-b pb-4">
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900">Material deviation</h1>
                                    <p className="text-sm text-slate-700 mt-1">
                                        What SLT reported versus what the contractor or staff entered. Manual entry drives stock; the SLT figure is only the reference.
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => void load()} disabled={loading}>
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                                </Button>
                            </div>

                            {error && <p className="text-sm text-red-700">{error}</p>}

                            {data && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {[
                                            ['Orders compared', data.summary.ordersCompared],
                                            ['With deviation', data.summary.ordersWithDeviation],
                                            ['Quantity differs', data.summary.qtyMismatch],
                                            ['Not entered', data.summary.notEntered],
                                            ['Not reported / unmapped', data.summary.notReported + data.summary.unmapped],
                                        ].map(([label, value]) => (
                                            <Card key={String(label)}><CardContent className="p-4">
                                                <p className="text-xs text-slate-700">{label}</p>
                                                <p className="text-2xl font-black text-slate-900">{value}</p>
                                            </CardContent></Card>
                                        ))}
                                    </div>

                                    <Card>
                                        <CardHeader><CardTitle className="text-base text-slate-900">Deviation rate by contractor</CardTitle></CardHeader>
                                        <CardContent>
                                            <table className="w-full text-sm text-slate-900">
                                                <thead><tr className="text-left"><th className="py-1">Contractor</th><th>Orders</th><th>With deviation</th><th>Rate</th></tr></thead>
                                                <tbody>
                                                    {data.byContractor.map((c) => (
                                                        <tr key={c.contractor} className="border-t"><td className="py-1">{c.contractor}</td><td>{c.orders}</td><td>{c.deviating}</td><td>{c.deviationRate}%</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle className="text-base text-slate-900">Orders with a deviation</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            {data.orders.length === 0 && <p className="text-sm text-slate-700">No deviations found.</p>}
                                            {data.orders.map((o) => (
                                                <div key={o.id} className="border rounded-lg p-3">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2 text-slate-900">
                                                        <span className="font-mono font-bold">{o.soNum}</span>
                                                        <Badge variant="outline" className="text-slate-800">{o.status}</Badge>
                                                        <span className="text-sm">{o.rtom} · {o.contractor || 'Unassigned'}</span>
                                                    </div>
                                                    <table className="w-full text-sm text-slate-900">
                                                        <thead><tr className="text-left"><th>Item</th><th>SLT</th><th>Entered</th><th>Diff</th><th>Wastage</th><th>Result</th></tr></thead>
                                                        <tbody>
                                                            {o.lines.filter((l) => l.type !== 'MATCH').map((l, i) => (
                                                                <tr key={i} className="border-t"><td>{l.label}</td><td>{l.reportedQty}</td><td>{l.manualQty}</td><td>{l.difference}</td><td>{l.wastageQty}</td><td>{TYPE_LABEL[l.type] ?? l.type}</td></tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
