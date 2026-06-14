/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { AlertTriangle, BookOpen, Layers, Shield, Users } from "lucide-react";

export default function Slide22() {
    const ledgerFeatures = [
        {
            title: "Registered Contractor Profiles",
            desc: "Maps company codes, bank account details, and active OPMCs.",
            icon: Users
        },
        {
            title: "Team Splits",
            desc: "Supports multiple technical teams registered under one parent contractor.",
            icon: Layers
        },
        {
            title: "Performance Trackers",
            desc: "Compare completion ratios, returns, and material wastage history.",
            icon: BookOpen
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Two Column Layout */}
                                            <div className="stagger-children grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                                {/* Left: Security Card */}
                                                <div className="card-success rounded-xl p-4 sm:p-6">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                                                            <Shield className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-sm sm:text-base">Contractor Verification Validation</h3>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-4">
                                                        Every contractor action is validated against registered verification codes. The system ensures only authorized teams can record progress, submit completions, or draw materials from stock.
                                                    </p>
    
                                                    {/* Warning Card */}
                                                    <div className="card-critical rounded-lg p-3 sm:p-4 flex items-start gap-3">
                                                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <h4 className="font-semibold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                                                                Code Mismatch Prevention
                                                            </h4>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                                                If contractor team lacks valid verification code, system blocks and locks the save button.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
    
                                                {/* Right: Contractor Master Ledger */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BookOpen className="w-5 h-5 text-blue-500" />
                                                        <h3 className="font-bold text-sm sm:text-base">Contractor Master Ledger</h3>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400">
                                                        A centralized registry of all registered contractors, their teams, and historical performance data.
                                                    </p>
    
                                                    <div className="space-y-3">
                                                        {ledgerFeatures.map((feature) => {
                                                            const Icon = feature.icon;
                                                            return (
                                                                <div
                                                                    key={feature.title}
                                                                    className="card-primary rounded-xl p-3 sm:p-4 flex items-start gap-3"
                                                                >
                                                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                                        <Icon className="w-4 h-4 text-blue-500" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-xs sm:text-sm">{feature.title}</h4>
                                                                        <p className="text-xs text-slate-700 dark:text-slate-400 mt-0.5">
                                                                            {feature.desc}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
