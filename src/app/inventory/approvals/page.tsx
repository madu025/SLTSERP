"use client";

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ClipboardCheck } from 'lucide-react';
import type { InventoryApprovalQueue, ApprovalRow } from '@/services/inventory/approval-queue.service';

const th = 'py-2 pr-3 text-left text-xs font-bold uppercase tracking-wide text-slate-900';
const td = 'py-2 pr-3 text-sm text-slate-900';

function Section({ title, hint, rows, href }: { title: string; hint: string; rows: ApprovalRow[]; href: string }) {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900">{title} <span className="ml-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{rows.length}</span></h2>
                    <Link href={href} className="text-sm font-semibold text-blue-800 underline">Open the page</Link>
                </div>
                <p className="mb-3 text-xs text-slate-700">{hint}</p>
                {rows.length === 0 ? (
                    <p className="py-4 text-sm font-medium text-slate-700">Nothing is waiting.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead><tr className="border-b border-slate-300"><th className={th}>Reference</th><th className={th}>Store</th><th className={th}>Raised by</th><th className={th}>Waiting</th><th className={th}>Detail</th><th className={th}></th></tr></thead>
                            <tbody className="divide-y divide-slate-200">
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td className={`${td} font-mono font-semibold`}>{r.ref}</td>
                                        <td className={td}>{r.store}</td>
                                        <td className={td}>{r.by}</td>
                                        <td className={td}>{r.ageDays === 0 ? 'today' : `${r.ageDays} day${r.ageDays === 1 ? '' : 's'}`}</td>
                                        <td className={td}>{r.detail}</td>
                                        <td className={td}>{r.own ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900" title="You raised it; someone else must approve it">yours</span> : null}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function InventoryApprovalsPage() {
    const { data, isLoading, error } = useQuery<InventoryApprovalQueue>({
        queryKey: ['inventory-approvals'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/inventory/approvals', { cache: 'no-store', signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load the approvals');
            return json.data ?? json;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
    });

    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900"><ClipboardCheck className="h-7 w-7 text-blue-700" /> Pending Approvals</h1>
                            <p className="mt-1 text-sm text-slate-700">Everything of your stores that waits for an approval, oldest first. What you raised yourself is marked: someone else approves it.</p>
                        </div>
                        {isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-700" /></div>}
                        {error && <p className="text-sm font-semibold text-red-700">{(error as Error).message}</p>}
                        {data && (
                            <>
                                <p className="text-sm font-semibold text-slate-900">{data.totals.all} waiting in all.</p>
                                <Section title="Material requests" hint="Review the quantities, then approve or reject." rows={data.requests} href="/inventory/requests" />
                                <Section title="Returns to the supplier (MRN)" hint="Approve the return so the stock leaves the store." rows={data.mrns} href="/inventory/admin/mrns" />
                                <Section title="Contractor wastage" hint="Wastage above the allowed percentage waits for approval." rows={data.wastage} href="/inventory/admin/wastage" />
                                <Section title="Stock-take variances" hint="Approve the counted variance so the stock is corrected." rows={data.stockTakes} href="/inventory/audit" />
                            </>
                        )}
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
