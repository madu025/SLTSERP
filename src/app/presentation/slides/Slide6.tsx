/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Layers, Settings, Users } from "lucide-react";

import React from "react";

export default function Slide6() {
    const steps = [
        {
            num: "01",
            title: "Details & Assignment",
            icon: Users,
            iconBg: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400",
            cardClass: "card-primary",
            topBorder: "bg-blue-500",
            fields: ["Completion Date", "DP Details", "Contractor Selection"]
        },
        {
            num: "02",
            title: "Material Usage & Wastage",
            icon: Layers,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            cardClass: "card-primary",
            topBorder: "bg-emerald-500",
            fields: ["F1 / G1 Drop-wire", "Connectors & Splitters", "Wastage Limit Check"]
        },
        {
            num: "03",
            title: "Device Serials & Comments",
            icon: Settings,
            iconBg: "bg-purple-100 dark:bg-purple-900/40",
            iconColor: "text-purple-600 dark:text-purple-400",
            cardClass: "card-primary",
            topBorder: "bg-purple-500",
            fields: ["New/Existing ONT Type", "ONT & IPTV Serial Numbers", "Closing Notes / Remarks"]
        }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            {/* Chapter Header */}
                            <div className="text-center mb-8 sm:mb-10">
                                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                    Service Order Details (SOD)
                                </span>
                                <h2 className="text-2xl sm:text-4xl font-bold">Completion Wizard</h2>
                                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2">
                                    Three guided steps to close any service order
                                </p>
                            </div>
    
                            {/* Step Cards */}
                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                                {steps.map((step) => {
                                    const Icon = step.icon;
                                    return (
                                        <div
                                            key={step.num}
                                            className={`${step.cardClass} rounded-xl overflow-hidden transition-transform hover:scale-105 hover:shadow-lg`}
                                        >
                                            <div className={`h-1.5 ${step.topBorder}`} />
                                            <div className="p-5 sm:p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <span className="text-3xl font-bold text-slate-200 dark:text-slate-700">{step.num}</span>
                                                    <div className={`w-9 h-9 rounded-lg ${step.iconBg} flex items-center justify-center`}>
                                                        <Icon className={`w-4 h-4 ${step.iconColor}`} />
                                                    </div>
                                                </div>
                                                <h3 className="font-semibold text-base sm:text-lg mb-3">{step.title}</h3>
                                                <ul className="space-y-2">
                                                    {step.fields.map((field: any) => (
                                                        <li key={field} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${step.topBorder} flex-shrink-0`} />
                                                            {field}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
}
