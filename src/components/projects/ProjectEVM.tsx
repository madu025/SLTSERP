"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity } from 'lucide-react';

interface ProjectEVMProps { project: any; }

export default function ProjectEVM({ project }: ProjectEVMProps) {
  const [evm, setEvm] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEVM(); }, [project.id]);

  const fetchEVM = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/evm`);
      const data = await res.json();
      if (data) {
        setEvm(data.evm);
        setSnapshots(data.snapshots || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount || 0);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = { GREEN: 'text-green-600 bg-green-50', AMBER: 'text-amber-600 bg-amber-50', RED: 'text-red-600 bg-red-50' };
    return colors[status] || 'text-slate-600 bg-slate-50';
  };

  const getCPIBadge = (cpi: number) => {
    if (!cpi) return <Badge variant="outline">N/A</Badge>;
    return <Badge className={cpi >= 1 ? 'bg-green-100 text-green-700' : cpi >= 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{cpi.toFixed(2)}</Badge>;
  };

  const getSPIBadge = (spi: number) => {
    if (!spi) return <Badge variant="outline">N/A</Badge>;
    return <Badge className={spi >= 1 ? 'bg-green-100 text-green-700' : spi >= 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{spi.toFixed(2)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Earned Value Management (EVM)</h3>
        <p className="text-sm text-slate-500">PV, EV, AC tracking with SPI, CPI, and variance analysis</p>
      </div>

      {evm && (
        <>
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border ${getStatusColor(evm.status)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Project Health: {evm.status}</p>
                <p className="text-xs opacity-75">{evm.statusNotes || 'All metrics within acceptable ranges'}</p>
              </div>
              <Activity className="w-8 h-8 opacity-50" />
            </div>
          </div>

          {/* Core EVM Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Planned Value (PV)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(evm.pvTotal)}</p>
                <p className="text-xs text-slate-500">Period: {formatCurrency(evm.pvCurrentPeriod)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Earned Value (EV)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(evm.evTotal)}</p>
                <p className="text-xs text-slate-500">Period: {formatCurrency(evm.evCurrentPeriod)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500 flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-500" /> Actual Cost (AC)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(evm.acTotal)}</p>
                <p className="text-xs text-slate-500">Period: {formatCurrency(evm.acCurrentPeriod)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Indices */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">CPI (Cost)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getCPIBadge(evm.cpi)}
                  <span className="text-xs text-slate-500">{evm.cpi && evm.cpi >= 1 ? 'Under Budget' : evm.cpi ? 'Over Budget' : ''}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">EV / AC</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">SPI (Schedule)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getSPIBadge(evm.spi)}
                  <span className="text-xs text-slate-500">{evm.spi && evm.spi >= 1 ? 'Ahead' : evm.spi ? 'Behind' : ''}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">EV / PV</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Schedule Variance</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${(evm.scheduleVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(evm.scheduleVariance || 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">EV - PV</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Cost Variance</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${(evm.costVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(evm.costVariance || 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">EV - AC</p>
              </CardContent>
            </Card>
          </div>

          {/* Forecasting */}
          <Card>
            <CardHeader><CardTitle className="text-base">Forecasting</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-500">Estimate at Completion (EAC)</p>
                  <p className="text-xl font-bold">{formatCurrency(evm.estimateAtCompletion || 0)}</p>
                  <p className="text-xs text-slate-400">BAC / CPI</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Estimate to Complete (ETC)</p>
                  <p className="text-xl font-bold">{formatCurrency(evm.estimateToComplete || 0)}</p>
                  <p className="text-xs text-slate-400">EAC - AC</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Variance at Completion (VAC)</p>
                  <p className={`text-xl font-bold ${(evm.varianceAtCompletion || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(evm.varianceAtCompletion || 0)}
                  </p>
                  <p className="text-xs text-slate-400">BAC - EAC</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Snapshots */}
          {snapshots.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">EVM History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-slate-500">Period</th>
                      <th className="text-right p-3 text-slate-500">PV</th>
                      <th className="text-right p-3 text-slate-500">EV</th>
                      <th className="text-right p-3 text-slate-500">AC</th>
                      <th className="text-right p-3 text-slate-500">SPI</th>
                      <th className="text-right p-3 text-slate-500">CPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium">{s.periodLabel}</td>
                        <td className="p-3 text-right">{formatCurrency(s.pvCumulative)}</td>
                        <td className="p-3 text-right">{formatCurrency(s.evCumulative)}</td>
                        <td className="p-3 text-right">{formatCurrency(s.acCumulative)}</td>
                        <td className="p-3 text-right">{s.spi?.toFixed(2) || '-'}</td>
                        <td className="p-3 text-right">{s.cpi?.toFixed(2) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!evm && !loading && (
        <Card><CardContent className="py-12 text-center text-slate-500">No EVM data calculated yet. Configure project baseline to begin tracking.</CardContent></Card>
      )}
    </div>
  );
}
