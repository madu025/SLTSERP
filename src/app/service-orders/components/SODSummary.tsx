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
    <Card className="shadow-none border h-14">
        <CardContent className="h-full px-3 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                <p className="text-xl font-bold text-slate-900 leading-none mt-0.5">{value}</p>
            </div>
            <div className={`p-1.5 rounded-md ${colorClass} bg-opacity-10`}>
                <Icon className={`w-4 h-4 ${colorClass.replace('bg-', 'text-')}`} />
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
            <SummaryCard title="Total SODs" value={summary.totalSod || 0} icon={FileText} colorClass="bg-blue-100 text-blue-600" />

            {filterType === 'completed' ? (
                <>
                    <SummaryCard title="Pending HO PAT" value={summary.patBreakdown?.ho?.PENDING || 0} icon={ClipboardList} colorClass="bg-indigo-100 text-indigo-600" />
                    <SummaryCard title="Pending SLT PAT" value={summary.patBreakdown?.slt?.PENDING || 0} icon={Activity} colorClass="bg-amber-100 text-amber-600" />
                    <SummaryCard title="Rejected" value={(summary.patBreakdown?.opmc?.REJECTED || 0) + (summary.patBreakdown?.ho?.REJECTED || 0) + (summary.patBreakdown?.slt?.REJECTED || 0)} icon={AlertCircle} colorClass="bg-rose-100 text-rose-600" />
                </>
            ) : (
                <>
                    <SummaryCard title="Contractors" value={summary.contractorAssigned || 0} icon={UserCheck} colorClass="bg-purple-100 text-purple-600" />
                    <SummaryCard title="Appointments" value={summary.appointments || 0} icon={CalendarCheck} colorClass="bg-indigo-100 text-indigo-600" />
                    <Card className="shadow-none border h-14">
                        <CardContent className="h-full px-3 py-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-orange-600" />
                                <span className="text-[10px] font-semibold text-slate-600 uppercase">Missing</span>
                            </div>
                            <span className="text-lg font-bold text-orange-600">{missingCount}</span>
                        </CardContent>
                    </Card>
                </>
            )}

            <Card className="shadow-none border h-14">
                <CardContent className="h-full px-3 py-1 flex flex-col justify-center">
                    <div className="w-full">
                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">In Progress</span> <span className="font-bold text-slate-700">{summary.statusBreakdown?.INPROGRESS || 0}</span></div>
                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">Inst. Closed</span> <span className="font-bold text-emerald-600">{summary.statusBreakdown?.INSTALL_CLOSED || 0}</span></div>
                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium">Prov. Closed</span> <span className="font-bold text-blue-600">{summary.statusBreakdown?.PROV_CLOSED || 0}</span></div>
                        <div className="flex justify-between items-center text-[12px] leading-tight"><span className="text-slate-500 font-medium whitespace-nowrap">Returned</span> <span className="font-bold text-rose-600">{summary.totalReturns || 0}</span></div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
