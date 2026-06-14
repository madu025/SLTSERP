/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Check, Package, FileEdit, ShoppingCart } from "lucide-react";

export default function Slide13() {
    const changeFeatures: any[] = [];
    const purchaseOrders: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8">
                                                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                                    OSP Project Management
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">Change Orders &amp; Procurement</h2>
                                            </div>
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Change Order */}
                                                <div className="card-warning rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                                            <FileEdit className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Change Orders</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-5">
                                                        Manage project scope changes with full traceability and financial impact tracking.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {changeFeatures.map((feat) => (
                                                            <div key={feat} className="flex items-start gap-2.5">
                                                                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                    <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                </span>
                                                                <span className="text-sm sm:text-base font-medium">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* Right - Procurement */}
                                                <div className="card-primary rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                                            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Procurement</h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {purchaseOrders.map((po) => (
                                                            <div
                                                                key={po.id}
                                                                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <Package className="w-4 h-4 text-slate-400" />
                                                                    <div>
                                                                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{po.id}</span>
                                                                        <p className="text-sm font-medium">{po.item}</p>
                                                                    </div>
                                                                </div>
                                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${po.badgeClass}`}>
                                                                    {po.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
