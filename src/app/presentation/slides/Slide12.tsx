/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { FolderTree } from "lucide-react";

export default function Slide12() {
    const wbsItems: any[] = [];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            {/* Chapter Header */}
                                            <div className="mb-6 sm:mb-8">
                                                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                                                    OSP Project Management
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <FolderTree className="w-7 h-7 text-blue-500" />
                                                    <h2 className="text-2xl sm:text-4xl font-bold">WBS Progress Tracking</h2>
                                                </div>
                                            </div>
    
                                            {/* Visual Tree Structure */}
                                            <div className="card-primary rounded-xl p-5 sm:p-8 max-w-3xl mx-auto w-full border">
                                                <div className="stagger-children space-y-4">
                                                    {wbsItems.map((item) => {
                                                        const indent = item.level === 1 ? "ml-4 sm:ml-8" : "";
                                                        return (
                                                            <div key={item.id} className={indent}>
                                                                <div className="flex items-center gap-3 mb-1.5">
                                                                    <span className="text-xs sm:text-sm font-mono font-bold text-slate-400">
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
