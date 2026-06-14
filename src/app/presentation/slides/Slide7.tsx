/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FileText, Grid, ShieldAlert } from "lucide-react";

import React from "react";

export default function Slide7() {
    const points = [
        {
            title: "Quick-Access Materials Grid",
            desc: "The most commonly consumed items (Drop-wire, Connectors, Splitters) are laid out as quick-entry fields.",
            icon: Grid,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        },
        {
            title: "Wastage Thresholds",
            desc: "If wastage values exceed maximum allowed limits (e.g. 5% on dropwire), a validation warning is logged.",
            icon: ShieldAlert,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        },
        {
            title: "Mandatory Reasons",
            desc: "Contractors must submit a valid explanation (e.g. 'damage on reel') for flagged wastage.",
            icon: FileText,
            iconBg: "bg-amber-100 dark:bg-amber-900/40",
            iconColor: "text-amber-600 dark:text-amber-400"
        }
    ];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            
    
                            {/* 3 Points */}
                            <div className="stagger-children space-y-3 sm:space-y-4 mb-8">
                                {points.map((point) => {
                                    const Icon = point.icon;
                                    return (
                                        <div key={point.title} className="card-warning rounded-xl p-4 sm:p-5">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-lg ${point.iconBg} flex items-center justify-center flex-shrink-0`}>
                                                    <Icon className={`w-4 h-4 ${point.iconColor}`} />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm sm:text-base">{point.title}</h4>
                                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {point.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
    
                            {/* Threshold Visual Example */}
                            <div className="card-primary rounded-xl p-5 sm:p-6 max-w-lg mx-auto w-full">
                                <h4 className="font-semibold text-sm sm:text-base mb-4">Threshold Example</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="font-medium">Drop-wire</span>
                                        <span className="text-slate-500 dark:text-slate-400">4.2% used / 5% limit</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all"
                                            style={{ width: "84%" }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>0%</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">4.2%</span>
                                        <span className="text-rose-500 font-medium">5% limit</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
}
