/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Check, ClipboardCheck, FileDown, FileText, Store, Warehouse } from "lucide-react";

export default function Slide18() {
    const documentTypes = [
        {
            title: "Goods Received Note (GRN) PDF",
            desc: "Supplier & Store receipt summary report.",
            icon: FileText,
            iconBg: "bg-purple-100 dark:bg-purple-900/40",
            iconColor: "text-purple-600 dark:text-purple-400"
        },
        {
            title: "Gate Pass / Issue Note PDF",
            desc: "Contains formal Security Check sign-off lines.",
            icon: ClipboardCheck,
            iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
            iconColor: "text-emerald-600 dark:text-emerald-400"
        }
    ];
    const auditFeatures = [
        "Standard Layout Templates",
        "Authorized Sign-offs",
        "Direct Downloads"
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Store PDF Generator */}
                                                <div className="card-analytics rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-5">
                                                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                                                            <FileDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Store PDF Generator</h3>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {documentTypes.map((doc) => {
                                                            const Icon = doc.icon;
                                                            return (
                                                                <div
                                                                    key={doc.title}
                                                                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                                                                >
                                                                    <div className={`w-9 h-9 rounded-lg ${doc.iconBg} flex items-center justify-center flex-shrink-0`}>
                                                                        <Icon className={`w-4.5 h-4.5 ${doc.iconColor}`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-semibold">{doc.title}</p>
                                                                        <p className="text-xs text-slate-700 dark:text-slate-400">{doc.desc}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
    
                                                {/* Right - Audit-Ready Paperwork */}
                                                <div className="card-success rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                                            <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Audit-Ready Paperwork</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-5">
                                                        Generate professional, sign-off-ready documents that meet compliance requirements and streamline warehouse operations.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {auditFeatures.map((feat) => (
                                                            <div key={feat} className="flex items-start gap-2.5">
                                                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                </span>
                                                                <span className="text-sm sm:text-base font-medium">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
