/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Shield } from "lucide-react";

export default function Slide1() {
    const roles: any[] = [];
                    return (
                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                            {/* Hero Section */}
                            <div className="text-center mb-8 sm:mb-12">
                                <div className="pulse-glow inline-block mb-6">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto shadow-lg">
                                        <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                                    </div>
                                </div>
                                <h1 className="text-3xl sm:text-5xl font-bold mb-3">
                                    <span className="bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500 bg-clip-text text-transparent">
                                        SLTS Workflow Management
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-3">
                                    End-to-End Telecom Operations Management Platform
                                </p>
                                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                                    Designed for OSP teams managing service orders, warehouse stock, contractor workflows, and billing — all within one unified system.
                                </p>
                            </div>
    
                            {/* Role Cards Grid */}
                            <div className="stagger-children grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                                {roles.map((role) => (
                                    <div
                                        key={role.title}
                                        className="card-primary rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-transform hover:scale-105 hover:shadow-lg"
                                    >
                                        <div className="text-3xl sm:text-4xl mb-2">{role.icon}</div>
                                        <h3 className="font-semibold text-sm sm:text-base mb-1">{role.title}</h3>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{role.desc}</p>
                                    </div>
                                ))}
                            </div>
    
                            {/* Navigation Hint */}
                            <div className="text-center mt-8 sm:mt-10">
                                <button
                                    onClick={() => { if (typeof window !== "undefined" && (window as any).__sltserp_navigate) (window as any).__sltserp_navigate(0); }}
                                    className="btn-focus inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
                                >
                                    Explore the Platform →
                                </button>
                            </div>
                        </div>
                    );
}
