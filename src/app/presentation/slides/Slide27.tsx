"use client";

import React from "react";
import { ArrowLeftRight, Smartphone, Landmark, BrainCircuit, Calculator, MessageSquare, Printer, Car } from "lucide-react";

export default function Slide27() {
    const upgrades = [
        {
            title: "Inter-Store Stock Routing",
            desc: "Enables regional storekeepers to request and transfer excess materials dynamically across OPMC stores to resolve local shortages.",
            icon: ArrowLeftRight,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
            title: "Offline Technician App",
            desc: "Mobile application for field teams to log material usage on-site, scan ONT serial numbers, and capture handover photos with offline synchronization.",
            icon: Smartphone,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
            title: "SLTS Finance Bank Portal",
            desc: "Generates bank-compatible bulk payment files (txt/csv) with dual-authorization workflows for SLTS Head Office Finance to approve and release payouts.",
            icon: Landmark,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        },
        {
            title: "AI Material Predictor",
            desc: "Predicts future inventory requirements (e.g., forecasting connectors and drop-wire needs for 500+ quarterly SODs) using historical consumption.",
            icon: BrainCircuit,
            iconBg: "bg-purple-100 dark:bg-purple-900/40",
            iconColor: "text-purple-600 dark:text-purple-400"
        },
        {
            title: "WBS Project Budget Planner",
            desc: "Automatically estimates project budgets and resource predictions based on WBS task structures, historical cost rates, and project plans.",
            icon: Calculator,
            iconBg: "bg-teal-100 dark:bg-teal-900/40",
            iconColor: "text-teal-600 dark:text-teal-400"
        },
        {
            title: "Contractor Payout SMS",
            desc: "Automated SMS notification engine that instantly texts field contractors once monthly invoice payments are disbursed by Head Office.",
            icon: MessageSquare,
            iconBg: "bg-rose-100 dark:bg-rose-900/40",
            iconColor: "text-rose-600 dark:text-rose-400"
        },
        {
            title: "ID Print Integration",
            desc: "Integrates the standalone ID printing module directly into the core ERP to automate official staff and contractor card issuance.",
            icon: Printer,
            iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
            iconColor: "text-indigo-600 dark:text-indigo-400"
        },
        {
            title: "Vehicle Management Mobile",
            desc: "Android application for vehicle logs, capturing real-time odometer/meter readings and tracking driver duty on/off states.",
            icon: Car,
            iconBg: "bg-cyan-100 dark:bg-cyan-900/40",
            iconColor: "text-cyan-600 dark:text-cyan-400"
        }
    ];

    return (
        <div className="flex flex-col h-full justify-center max-w-6xl mx-auto py-2 sm:py-6">
            {/* 4x2 Grid of Cards */}
            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {upgrades.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.title}
                            className="card-primary rounded-xl p-4 transition-transform hover:scale-[1.03] hover:shadow-lg border border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between"
                        >
                            <div>
                                <div className={`w-9 h-9 rounded-lg ${item.iconBg} flex items-center justify-center mb-2.5`}>
                                    <Icon className={`w-4.5 h-4.5 ${item.iconColor}`} />
                                </div>
                                <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
