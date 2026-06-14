"use client";

import React from "react";

export default function Slide27() {
    const upgrades = [
        { title: "Cashflow Ledger", emoji: "📊", desc: "Track organizational income, outstanding payments, and regional cost centers." },
        { title: "Accounting Package Sync", emoji: "🔌", desc: "Integrate with QuickBooks, SAP to sync contractor ledger balances." },
        { title: "Technicians App", emoji: "📱", desc: "Technicians receive jobs, scan barcodes, and attach closure photos on site." },
        { title: "GPS Dispatching", emoji: "🗺️", desc: "Track team locations on a live map and auto-assign tasks to closest units." },
        { title: "Automated SMS", emoji: "📨", desc: "Auto-send confirmation messages to customers on job dispatch and completion." },
        { title: "AI Stock Predictor", emoji: "🤖", desc: "Forecast safety stock depletion dates using historical consumption models." }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* 3x2 Grid of Cards */}
                                            <div className="stagger-children grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                                {upgrades.map((item) => (
                                                    <div
                                                        key={item.title}
                                                        className="card-primary rounded-xl p-4 sm:p-5 transition-transform hover:scale-[1.02] hover:shadow-lg"
                                                    >
                                                        <div className="text-2xl sm:text-3xl mb-2">{item.emoji}</div>
                                                        <h3 className="font-mono text-xs sm:text-sm font-bold text-blue-500 uppercase mb-1.5">
                                                            {item.title}
                                                        </h3>
                                                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-400">
                                                            {item.desc}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
}
