"use client";

import React, { useEffect, useState } from 'react';
import { Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export default function ExtensionStatus() {
    const [isInstalled, setIsInstalled] = useState(false);
    const [version, setVersion] = useState("");
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const check = () => {
            const hasAttr = document.documentElement.getAttribute('data-slt-bridge-installed') === 'true';
            const ver = document.documentElement.getAttribute('data-slt-bridge-version') || (window as any).SLT_BRIDGE_VERSION;

            if (hasAttr || ver) {
                setIsInstalled(true);
                setVersion(ver || "1.1.0");
                setChecking(false);
                return true;
            }
            return false;
        };

        const handleDetected = () => {
            setIsInstalled(true);
            setChecking(false);
        };

        window.addEventListener('SLT_BRIDGE_DETECTED', handleDetected);

        const check1 = setTimeout(() => { if (!check()) { /* continue waiting */ } }, 500);
        const check2 = setTimeout(() => { if (!check()) setChecking(false); }, 2000);
        const check3 = setTimeout(() => { if (!check()) setChecking(false); }, 5000);

        return () => {
            clearTimeout(check1);
            clearTimeout(check2);
            clearTimeout(check3);
            window.removeEventListener('SLT_BRIDGE_DETECTED', handleDetected);
        };
    }, []);

    if (checking) return null;

    if (isInstalled) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">Bridge Connected</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4 shadow-xl border-emerald-100" align="end">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Status</span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">ONLINE</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Version</span>
                            <span className="text-[10px] font-mono">{version}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400 leading-tight">
                                Extension is ready. Navigating to SOD details in SLT portal will sync data to ERP.
                            </p>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse hover:bg-amber-100 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Bridge Missing</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl border-amber-100" align="end">
                <div className="bg-amber-50 p-4 border-b border-amber-100">
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Install SLT Bridge v1.3.0
                    </h3>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        To sync Team Assignments, Serial Numbers, and Materials directly from SLT Portal, install the updated extension.
                    </p>
                </div>
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">1</div>
                            <span className="text-xs font-medium">Download the updated ZIP</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">2</div>
                            <span className="text-xs font-medium">Extract to a folder</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">3</div>
                            <span className="text-xs font-medium">Load in Extensions (Developer Mode)</span>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        size="sm"
                        onClick={() => window.open('/slt-bridge.zip', '_blank')}
                    >
                        Download Extension v1.3.0
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
