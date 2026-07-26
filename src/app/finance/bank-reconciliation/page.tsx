'use client';

import React, { useState } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';

export default function BankReconciliationPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        // Simple CSV parser for demo purposes
        // Assumes format: Date,Description,Reference,Amount
        // e.g. "2026-07-25,Deposit,REF123,50000"
        const rows = text.split('\n').filter(line => line.trim().length > 0).slice(1).map(line => {
          const [date, description, ref, amount] = line.split(',');
          return {
            date: date.trim(),
            description: description.trim(),
            referenceNumber: ref.trim(),
            amount: parseFloat(amount.trim())
          };
        });

        const res = await fetch('/api/finance/bank-reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows })
        });

        if (res.ok) {
          const data = await res.json();
          setResult(data.data);
        } else {
          console.error('Failed to reconcile');
        }
      } catch (err) {
        console.error('File parsing error', err);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(val);
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Auto Bank Reconciliation</h1>
              <p className="text-slate-500 mt-1">Upload standard Bank CSV to match with General Ledger (Account 1001).</p>
            </div>

            <Card className="mb-8 border-slate-200 shadow-sm">
              <CardContent className="p-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 m-6">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Upload Bank Statement (CSV)</h3>
                <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                  Ensure the CSV has headers: Date, Description, Reference, Amount. Positive amounts for deposits, negative for withdrawals.
                </p>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  <Button disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" />
                    {loading ? 'Reconciling...' : 'Select CSV File'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {result && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-full">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Auto-Matched Transactions</p>
                          <h3 className="text-2xl font-bold text-slate-900">{result.matchedCount}</h3>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-rose-500 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-100 rounded-full">
                          <XCircle className="w-6 h-6 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500">Unmatched / Requires Review</p>
                          <h3 className="text-2xl font-bold text-slate-900">{result.unmatchedCount}</h3>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {result.matchedCount > 0 && (
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                      <CardTitle className="text-base text-slate-800">Matched GL Entries</CardTitle>
                    </CardHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 font-medium">Bank Date</th>
                            <th className="px-6 py-3 font-medium">Description</th>
                            <th className="px-6 py-3 font-medium text-right">Amount</th>
                            <th className="px-6 py-3 font-medium text-center">GL Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.matches.map((m: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-6 py-4">{format(new Date(m.statementRow.date), 'MMM dd, yyyy')}</td>
                              <td className="px-6 py-4">{m.statementRow.description}</td>
                              <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(m.statementRow.amount)}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  {m.journalReference}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
