"use client";

import React from "react";
import { Warehouse, ShieldAlert, Check, Store } from "lucide-react";

export default function Slide17() {
    const safetyFeatures = [
        "Configurable Thresholds",
        "Multi-Store Support",
        "Auto-Procurement Suggestions"
    ];
    const storeStatuses = [
        { name: "Colombo Store", status: "OK", dotClass: "bg-emerald-500", colorClass: "text-emerald-600 dark:text-emerald-400" },
        { name: "Gampaha Store", status: "LOW", dotClass: "bg-amber-500", colorClass: "text-amber-600 dark:text-amber-400" },
        { name: "Kandy Store", status: "CRIT", dotClass: "bg-rose-500", colorClass: "text-rose-600 dark:text-rose-500" }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Description & Features */}
                                                <div className="card-warning rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                                            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Safety Stock</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mb-5">
                                                        Prevent stock-outs with configurable minimum thresholds that trigger automatic alerts and procurement suggestions.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {safetyFeatures.map((feat) => (
                                                            <div key={feat} className="flex items-start gap-2.5">
                                                                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                    <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                </span>
                                                                <span className="text-sm sm:text-base font-medium">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* Right - Stock Alert Dashboard */}
                                                <div className="card-critical rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                                                            <Store className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Stock Alert Dashboard</h3>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                                        {storeStatuses.map((store) => (
                                                            <div
                                                                key={store.name}
                                                                className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-center"
                                                            >
                                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">{store.name}</p>
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <span className={`w-2 h-2 rounded-full ${store.dotClass}`} />
                                                                    <span className={`text-sm font-bold ${store.colorClass.split(" ").pop()}`}>
                                                                        {store.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
    
                                                    {/* Alert Card */}
                                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-100 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                                                        <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                                                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                                                            Automatically broadcasts notifications when stock falls below thresholds
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
