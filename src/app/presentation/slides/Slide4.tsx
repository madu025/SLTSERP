/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FileSpreadsheet, Layers, ShieldAlert, Zap } from "lucide-react";

import React from "react";

export default function Slide4() {
    const capabilities = [
        {
            title: "Sheet Mode",
            desc: "Dense spreadsheet-style table optimized for rapid inline editing and bulk data updates.",
            icon: FileSpreadsheet,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400",
            cardClass: "card-primary"
        },
        {
            title: "Completion Wizard",
            desc: "Guided 3-step completion flow enforcing detail tracking, material inputs, and device verification.",
            icon: Layers,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            cardClass: "card-primary"
        },
        {
            title: "Wastage Control",
            desc: "Enforce strict material limits and splits between SLT-sourced and SLTS-sourced materials.",
            icon: ShieldAlert,
            iconBg: "bg-rose-100 dark:bg-rose-900/40",
            iconColor: "text-rose-600 dark:text-rose-400",
            cardClass: "card-primary"
        },
        {
            title: "Excel Import",
            desc: "Bulk upload customer ticket datasets and synchronize directly via smart mapping API bridges.",
            icon: Zap,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400",
            cardClass: "card-primary"
        }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            
    
                            {/* 2x2 Capability Grid */}
                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto">
                                {capabilities.map((cap) => {
                                    const Icon = cap.icon;
                                    return (
                                        <div
                                            key={cap.title}
                                            className={`${cap.cardClass} rounded-xl p-5 sm:p-6 transition-transform hover:scale-105 hover:shadow-lg cursor-pointer`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-10 h-10 rounded-lg ${cap.iconBg} flex items-center justify-center`}>
                                                    <Icon className={`w-5 h-5 ${cap.iconColor}`} />
                                                </div>
                                                <h3 className="font-semibold text-base sm:text-lg">{cap.title}</h3>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{cap.desc}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
}
