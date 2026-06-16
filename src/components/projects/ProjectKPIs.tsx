import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Coins, CalendarRange, Gauge, AlertCircle, ArrowUpRight } from 'lucide-react';

interface Project {
    id: string;
}

interface KPIMetrics {
    budget: number;
    actualCost: number;
    earnedValue: number;
    plannedValue: number;
    spi: number;
    cpi: number;
    variance: number;
    progressPercent: number;
}

interface KPIStatus {
    costStatus: string;
    scheduleStatus: string;
}

interface ProjectKPIsProps {
    project: Project;
}

export default function ProjectKPIs({ project }: ProjectKPIsProps) {
    const [metrics, setMetrics] = useState<KPIMetrics | null>(null);
    const [status, setStatus] = useState<KPIStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchKPIs();
    }, [project.id]);

    const fetchKPIs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${project.id}/kpis`);
            if (res.ok) {
                const data = await res.json();
                setMetrics(data.metrics);
                setStatus(data.status);
            }
        } catch (error) {
            console.error('Error fetching KPIs:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    if (loading) return <div className="text-center py-12 text-slate-500">Calculating KPI analytics...</div>;

    if (!metrics || !status) return <div className="text-center py-12 text-slate-500 font-medium">Failed to calculate KPIs</div>;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900">Project Performance & Earned Value (EVM)</h3>
                <p className="text-sm text-slate-500">Real-time schedule efficiency indexes, cost variances, and baseline comparisons.</p>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* SPI */}
                <Card className="border shadow-sm relative overflow-hidden">
                    <div className={`absolute top-0 right-0 left-0 h-1 ${metrics.spi >= 1.0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Schedule Performance (SPI)</CardDescription>
                        <CardTitle className="text-2xl font-black text-slate-900 mt-1">{metrics.spi}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 flex justify-between items-center">
                        <span className="text-[10px] font-medium text-slate-500">Target &gt;= 1.0</span>
                        <Badge className={status.scheduleStatus === 'AHEAD_OF_SCHEDULE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {status.scheduleStatus.replace(/_/g, ' ')}
                        </Badge>
                    </CardContent>
                </Card>

                {/* CPI */}
                <Card className="border shadow-sm relative overflow-hidden">
                    <div className={`absolute top-0 right-0 left-0 h-1 ${metrics.cpi >= 1.0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cost Efficiency (CPI)</CardDescription>
                        <CardTitle className="text-2xl font-black text-slate-900 mt-1">{metrics.cpi}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 flex justify-between items-center">
                        <span className="text-[10px] font-medium text-slate-500">Target &gt;= 1.0</span>
                        <Badge className={status.costStatus === 'UNDER_BUDGET' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {status.costStatus.replace(/_/g, ' ')}
                        </Badge>
                    </CardContent>
                </Card>

                {/* Budget vs Actual */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Budget Allocation</CardDescription>
                        <CardTitle className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(metrics.budget)}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-[10px] text-slate-500">
                        Total allocated WBS budget limit.
                    </CardContent>
                </Card>

                {/* Actual Cost */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actual Cost (AC)</CardDescription>
                        <CardTitle className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(metrics.actualCost)}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-[10px] text-slate-500">
                        Total logged project expenses to date.
                    </CardContent>
                </Card>
            </div>

            {/* EVM detailed breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-900">Earned Value Management (EVM) Ledger</CardTitle>
                        <CardDescription className="text-xs">Comparison indices compiled from task progress percentages.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                        {/* Progress Bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium text-slate-700">
                                <span>Project Execution Progress</span>
                                <span>{metrics.progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${metrics.progressPercent}%` }} />
                            </div>
                        </div>

                        {/* EV, PV, AC bars */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Earned Value (EV)</span>
                                <h5 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(metrics.earnedValue)}</h5>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Planned Value (PV)</span>
                                <h5 className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(metrics.plannedValue)}</h5>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cost Variance (CV)</span>
                                <h5 className={`text-sm font-bold mt-1 ${metrics.variance >= 0 ? 'text-green-600' : 'text-red-650'}`}>
                                    {formatCurrency(metrics.variance)}
                                </h5>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* SPI / CPI Explanatory */}
                <Card className="border shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-500" /> EVM Interpretation Guide
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3.5 text-xs pt-0">
                        <div className="flex items-start gap-2">
                            <ArrowUpRight className="w-4.5 h-4.5 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-slate-650 leading-relaxed">
                                <strong>SPI & CPI &gt;= 1.0</strong>: Project is executing under budget and ahead of the schedule baseline. Good health.
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4.5 h-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-slate-650 leading-relaxed">
                                <strong>SPI & CPI &lt; 1.0</strong>: Out-of-bounds parameters. Highlights material leakage, task delays, or crew under-loading.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Simple Icon wrapper for Info
function Info(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    )
}
