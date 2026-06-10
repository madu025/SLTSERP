"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ClipboardList, Activity, AlertCircle, UserCheck, CalendarCheck } from "lucide-react";

interface SummaryMetrics {
    totalSod: number;
    contractorAssigned: number;
    appointments: number;
    statusBreakdown: Record<string, number>;
    totalReturns?: number;
    patBreakdown?: {
        opmc: Record<string, number>;
        ho: Record<string, number>;
        slt: Record<string, number>;
    };
}

interface SummaryCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    colorClass: string;
}

const SummaryCard = ({ title, value, icon: Icon, colorClass }: SummaryCardProps) => (
    <Card className="shadow-sm border border-border/40 h-20 hover:shadow-md transition-shadow duration-250">
        <CardContent className="h-full p-3.5 flex flex-col justify-between relative overflow-hidden">
            <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">{value}</p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 leading-none">{title}</p>
            </div>
            <div className={`absolute right-3.5 bottom-3 p-1.5 rounded-md ${colorClass}`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
        </CardContent>
    </Card>
);

interface SODSummaryProps {
    filterType: string;
    summary: SummaryMetrics;
    missingCount: number;
}

export function SODSummary({ filterType, summary, missingCount }: SODSummaryProps) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <SummaryCard 
                title="Total SODs" 
                value={summary.totalSod || 0} 
                icon={FileText} 
                colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
            />

            {filterType === 'completed' ? (
                <>
                    <SummaryCard 
                        title="Pending HO PAT" 
                        value={summary.patBreakdown?.ho?.PENDING || 0} 
                        icon={ClipboardList} 
                        colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                    />
                    <SummaryCard 
                        title="Pending SLT PAT" 
                        value={summary.patBreakdown?.slt?.PENDING || 0} 
                        icon={Activity} 
                        colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                    />
                    <SummaryCard 
                        title="Rejected" 
                        value={(summary.patBreakdown?.opmc?.REJECTED || 0) + (summary.patBreakdown?.ho?.REJECTED || 0) + (summary.patBreakdown?.slt?.REJECTED || 0)} 
                        icon={AlertCircle} 
                        colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                    />
                </>
            ) : (
                <>
                    <SummaryCard 
                        title="Contractors" 
                        value={summary.contractorAssigned || 0} 
                        icon={UserCheck} 
                        colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                    />
                    <SummaryCard 
                        title="Appointments" 
                        value={summary.appointments || 0} 
                        icon={CalendarCheck} 
                        colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                    />
                    <SummaryCard 
                        title="Missing" 
                        value={missingCount} 
                        icon={AlertCircle} 
                        colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                    />
                </>
            )}

            <Card className="shadow-sm border border-border/40 h-20">
                <CardContent className="h-full px-3 py-2.5 flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9.5px]">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-0.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-tight">In Progress</span> 
                            <span className="font-extrabold text-amber-500">{summary.statusBreakdown?.INPROGRESS || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-0.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-tight">Inst. Closed</span> 
                            <span className="font-extrabold text-emerald-500">{summary.statusBreakdown?.INSTALL_CLOSED || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-0.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-tight">Prov. Closed</span> 
                            <span className="font-extrabold text-blue-500">{summary.statusBreakdown?.PROV_CLOSED || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-0.5">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-tight">Returned</span> 
                            <span className="font-extrabold text-rose-500">{summary.totalReturns || 0}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
