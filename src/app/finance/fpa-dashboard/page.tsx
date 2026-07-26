'use client';

import React, { useState, useEffect } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface FPAMetrics {
  period: string;
  totalRevenue: number;
  totalCOGS: number;
  grossMargin: number;
  grossMarginPct: number;
  totalOpex: number;
  netProfit: number;
  netProfitPct: number;
}

export default function FPADashboardPage() {
  const [metrics, setMetrics] = useState<FPAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState<string>('all');

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        let url = `/api/finance/fpa-dashboard?year=${year}&_t=${Date.now()}`;
        if (quarter !== 'all') {
          url += `&quarter=${quarter}`;
        }
        
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache' }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.data);
        }
      } catch (error) {
        console.error('Error fetching FP&A metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [year, quarter]);

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
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Predictive FP&A Variance</h1>
                <p className="text-slate-500 mt-1">Real-time profitability insights against General Ledger.</p>
              </div>
              <div className="flex gap-4">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Full Year</SelectItem>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Revenue Card */}
                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Total Revenue</p>
                        <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.totalRevenue)}</h3>
                      </div>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Gross Margin Card */}
                <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Gross Margin</p>
                        <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.grossMargin)}</h3>
                        <div className="flex items-center mt-2">
                          <span className={`text-sm font-semibold flex items-center ${metrics.grossMarginPct > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {metrics.grossMarginPct > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {metrics.grossMarginPct}%
                          </span>
                          <span className="text-xs text-slate-400 ml-2">of Revenue</span>
                        </div>
                      </div>
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Activity className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* OPEX Card */}
                <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Total OPEX</p>
                        <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.totalOpex)}</h3>
                      </div>
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Net Profit Card */}
                <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-purple-50">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Net Profit</p>
                        <h3 className="text-2xl font-bold text-purple-900">{formatCurrency(metrics.netProfit)}</h3>
                        <div className="flex items-center mt-2">
                          <span className={`text-sm font-bold flex items-center ${metrics.netProfitPct > 0 ? 'text-purple-700' : 'text-red-600'}`}>
                            {metrics.netProfitPct > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {metrics.netProfitPct}%
                          </span>
                          <span className="text-xs text-slate-500 ml-2">Margin</span>
                        </div>
                      </div>
                      <div className="p-2 bg-purple-200 rounded-lg shadow-sm">
                        <DollarSign className="w-5 h-5 text-purple-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            ) : (
              <div className="text-center text-slate-500 py-12">Failed to load FP&A metrics.</div>
            )}
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
