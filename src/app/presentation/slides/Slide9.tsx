/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { AlertCircle, Clipboard, Upload, Zap } from "lucide-react";

export default function Slide9() {
    const features = [
        {
            title: "Drag-and-Drop Files",
            desc: "Uploads `.xlsx`, `.xls` or `.csv` spreadsheets.",
            icon: Upload
        },
        {
            title: "Copy & Paste Mode",
            desc: "Directly paste grid rows copied from desktop spreadsheets.",
            icon: Clipboard
        },
        {
            title: "Validation Preview",
            desc: "Displays a table highlighting missing columns (like missing SOD or RTOM values) before saving.",
            icon: AlertCircle
        }
    ];
    const bridgeSteps = [
        "Fetches pre-logged material logs for the ticket from `/api/service-orders/bridge-sync`.",
        "Parses aliases and maps code values to local stock items.",
        "Automatically pre-fills quantities used, saving the contractor from double-entering data."
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Features with Checkmarks */}
                                                <div className="stagger-children space-y-4">
                                                    {features.map((feat) => {
                                                        const Icon = feat.icon;
                                                        return (
                                                            <div key={feat.title} className="card-primary rounded-xl p-4 sm:p-5">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                                                                        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-sm sm:text-base">{feat.title}</h4>
                                                                            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                                                                <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                                            {feat.desc}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
    
                                                {/* Right - Portal Sync Bridge API */}
                                                <div className="card-info rounded-xl p-5 sm:p-6">
                                                    <div className="flex items-center gap-2 mb-5">
                                                        <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                                                            <Zap className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-base sm:text-lg">Portal Sync Bridge API</h3>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {bridgeSteps.map((step, idx) => (
                                                            <div key={idx} className="flex items-start gap-3">
                                                                <span className="w-6 h-6 rounded-md bg-cyan-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                    {idx + 1}
                                                                </span>
                                                                <code className="text-xs sm:text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg block w-full text-slate-700 dark:text-slate-300">
                                                                    {step}
                                                                </code>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
