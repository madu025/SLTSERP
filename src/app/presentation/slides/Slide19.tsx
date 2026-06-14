"use client";

import { Database, Monitor, Server } from "lucide-react";

import React from "react";

export default function Slide19() {
    const layers = [
        {
            label: "Client UI Layer",
            detail: "Next.js pages & React components using Tailwind CSS.",
            icon: Monitor,
            cardClass: "card-primary",
            borderColor: "border-slate-800",
            textColor: "text-blue-400"
        },
        {
            label: "Service Layer",
            detail: "Business logic routing, validations, and controller operations.",
            icon: Server,
            cardClass: "card-primary",
            borderColor: "border-slate-800",
            textColor: "text-emerald-400"
        },
        {
            label: "Repository Layer",
            detail: "Database queries, transaction processing, and data persistence.",
            icon: Database,
            cardClass: "card-primary",
            borderColor: "border-slate-800",
            textColor: "text-purple-400"
        }
    ];
                                    return (
                                        <div className="flex flex-col h-full justify-center max-w-5xl mx-auto py-2 sm:py-6">
                                            
    
                                            {/* Layered Architecture Diagram */}
                                            <div className="stagger-children flex flex-col items-center gap-1 max-w-2xl mx-auto">
                                                {layers.map((layer, idx) => {
                                                    const Icon = layer.icon;
                                                    return (
                                                        <React.Fragment key={layer.label}>
                                                            <div
                                                                className={`arch-layer ${layer.cardClass} ${layer.borderColor} w-full max-w-md`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <Icon className={`w-4 h-4 ${layer.textColor} flex-shrink-0`} />
                                                                    <div className="text-left">
                                                                        <span className={`font-bold ${layer.textColor}`}>{layer.label}</span>
                                                                        <span className="block text-xs text-slate-700 dark:text-slate-400 font-normal">
                                                                            {layer.detail}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {idx < layers.length - 1 && (
                                                                <div className="arch-arrow">↓</div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
}
