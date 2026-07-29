'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { format } from 'date-fns';

interface LedgerLine {
  id: string;
  accountCode: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  lines: LedgerLine[];
}

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetch(`/api/finance/general-ledger?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.data);
        }
      } catch (error) {
        console.error('Error fetching GL:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  const flatLines = (Array.isArray(entries) ? entries : []).flatMap(entry => 
    (entry.lines || []).map((line: LedgerLine) => ({
      id: line.id,
      transactionDate: entry.date,
      account: { accountCode: line.accountCode, accountName: line.accountName },
      description: line.description || entry.description,
      sourceModule: entry.referenceType || 'MANUAL',
      referenceId: entry.referenceId || entry.id,
      debitAmount: Number(line.debit) || 0,
      creditAmount: Number(line.credit) || 0
    }))
  );

  const totalDebit = flatLines.reduce((acc, curr) => acc + curr.debitAmount, 0);
  const totalCredit = flatLines.reduce((acc, curr) => acc + curr.creditAmount, 0);

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Central General Ledger</h1>
                <p className="text-sm text-slate-500">Automated double-entry accounting ledger.</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Debits (DR)</p>
                    <p className="text-2xl font-bold text-slate-900">LKR {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Credits (CR)</p>
                    <p className="text-2xl font-bold text-slate-900">LKR {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-medium text-slate-600">Date</th>
                        <th className="p-4 font-medium text-slate-600">Account</th>
                        <th className="p-4 font-medium text-slate-600">Description</th>
                        <th className="p-4 font-medium text-slate-600">Ref / Source</th>
                        <th className="p-4 font-medium text-slate-600 text-right">Debit (LKR)</th>
                        <th className="p-4 font-medium text-slate-600 text-right">Credit (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
                      ) : entries.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">No Ledger Entries found</td></tr>
                      ) : (
                        flatLines.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-600">{format(new Date(entry.transactionDate), 'yyyy-MM-dd HH:mm')}</td>
                            <td className="p-4">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 mr-2">{entry.account.accountCode}</span>
                              <span className="font-medium text-slate-900">{entry.account.accountName}</span>
                            </td>
                            <td className="p-4 text-slate-600 truncate max-w-xs">{entry.description}</td>
                            <td className="p-4">
                              <div className="text-xs font-semibold text-indigo-600">{entry.sourceModule}</div>
                              <div className="text-xs text-slate-400 font-mono">{entry.referenceId.slice(-8)}</div>
                            </td>
                            <td className="p-4 font-medium text-right text-slate-900">{entry.debitAmount > 0 ? entry.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                            <td className="p-4 font-medium text-right text-slate-900">{entry.creditAmount > 0 ? entry.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
