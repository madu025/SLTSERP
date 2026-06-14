/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { BookOpen, Warehouse, Check } from "lucide-react";

export default function Slide16() {
    const ledgerData = [
        {
            item: "Drop Wire (m)",
            received: "+12,500",
            receivedColor: "text-emerald-600 dark:text-emerald-400",
            issued: "-8,200",
            issuedColor: "text-rose-600 dark:text-rose-400",
            balance: "4,300",
            balanceColor: "text-slate-800 dark:text-slate-200"
        },
        {
            item: "ONT Router",
            received: "+320",
            receivedColor: "text-emerald-600 dark:text-emerald-400",
            issued: "-285",
            issuedColor: "text-rose-600 dark:text-rose-400",
            balance: "35",
            balanceColor: "text-slate-800 dark:text-slate-200"
        }
    ];
    const features = [
        "Goods Received Notes (GRN)",
        "Material Issue Tracking",
        "Stock Ledger Running Balance"
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8">
                                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                                                    Warehouse &amp; Stock Control
                                                </span>
                                                <h2 className="text-2xl sm:text-4xl font-bold">Stock Ledger &amp; GRN</h2>
                                            </div>
    
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                                {/* Left - Description & Features */}
                                                <div className="card-success rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                                            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <h3 className="font-semibold text-lg sm:text-xl">Stock Ledger</h3>
                                                    </div>
                                                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-5">
                                                        A running record of every receipt and issue, giving you an always-accurate view of current stock levels.
                                                    </p>
                                                    <div className="space-y-3">
                                                        {features.map((feat) => (
                                                            <div key={feat} className="flex items-center gap-2.5">
                                                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                                                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                </span>
                                                                <span className="text-sm sm:text-base font-medium">{feat}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
    
                                                {/* Right - Stock Ledger Table / Mobile Cards */}
                                                <div className="card-primary rounded-xl p-5 sm:p-6 border flex flex-col justify-center">
                                                    <h3 className="font-semibold text-base sm:text-lg mb-4 text-center">Current Stock Position</h3>
    
                                                    {/* Desktop Table */}
                                                    <div className="desktop-table">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                                    <th className="text-left py-2 font-semibold text-slate-600 dark:text-slate-300">Item</th>
                                                                    <th className="text-right py-2 font-semibold text-slate-600 dark:text-slate-300">Received</th>
                                                                    <th className="text-right py-2 font-semibold text-slate-600 dark:text-slate-300">Issued</th>
                                                                    <th className="text-right py-2 font-semibold text-slate-600 dark:text-slate-300">Balance</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {ledgerData.map((row) => (
                                                                    <tr key={row.item} className="border-b border-slate-100 dark:border-slate-800">
                                                                        <td className="py-2.5 font-medium">{row.item}</td>
                                                                        <td className={`py-2.5 text-right font-mono font-semibold ${row.receivedColor}`}>{row.received}</td>
                                                                        <td className={`py-2.5 text-right font-mono font-semibold ${row.issuedColor}`}>{row.issued}</td>
                                                                        <td className={`py-2.5 text-right font-mono font-bold ${row.balanceColor}`}>{row.balance}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
    
                                                    {/* Mobile Cards */}
                                                    <div className="mobile-card-row space-y-3">
                                                        {ledgerData.map((row) => (
                                                            <div
                                                                key={row.item}
                                                                className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                                                            >
                                                                <p className="font-semibold text-sm mb-2">{row.item}</p>
                                                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                                    <div>
                                                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Received</p>
                                                                        <p className={`font-mono font-bold ${row.receivedColor}`}>{row.received}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Issued</p>
                                                                        <p className={`font-mono font-bold ${row.issuedColor}`}>{row.issued}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Balance</p>
                                                                        <p className={`font-mono font-bold ${row.balanceColor}`}>{row.balance}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
}
