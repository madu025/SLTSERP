"use client";

import React from "react";
import { FolderTree } from "lucide-react";

export default function Slide12() {
    const wbsItems = [
        { id: "1.0", label: "Civil Works", percent: 78, level: 0, textColor: "text-emerald-500", color: "bg-emerald-500" },
        { id: "1.1", label: "Pole Installation", percent: 100, level: 1, textColor: "text-emerald-500", color: "bg-emerald-500" },
        { id: "1.2", label: "Duct Laying", percent: 56, level: 1, textColor: "text-amber-500", color: "bg-amber-500" }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Visual Tree Structure */}
                                            <div className="card-primary rounded-xl p-5 sm:p-8 max-w-3xl mx-auto w-full border">
                                                <div className="stagger-children space-y-4">
                                                    {wbsItems.map((item) => {
                                                        const indent = item.level === 1 ? "ml-4 sm:ml-8" : "";
                                                        return (
                                                            <div key={item.id} className={indent}>
                                                                <div className="flex items-center gap-3 mb-1.5">
                                                                    <span className="text-xs sm:text-sm font-mono font-bold text-slate-700">
                                                                        {item.id}
                                                                    </span>
                                                                    <span className="text-sm sm:text-base font-semibold">{item.label}</span>
                                                                    <span className={`text-sm sm:text-base font-bold ${item.textColor}`}>
                                                                        {item.percent}%
                                                                    </span>
                                                                </div>
                                                                <div className="progress-bar-wrapper">
                                                                    <div className="progress-bar-track">
                                                                        <div
                                                                            className={`progress-bar-fill ${item.color}`}
                                                                            style={{ width: `${item.percent}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={`progress-bar-text ${item.textColor}`}>
                                                                        {item.percent}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
}
