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
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // 1. Initial Check
        const check = () => {
            const installed = document.documentElement.getAttribute('data-slt-bridge-installed') === 'true';
            setIsInstalled(installed);
            setChecking(false);
        };

        // 2. Listen for the event (if extension loads after page)
        window.addEventListener('SLT_BRIDGE_DETECTED', () => {
            setIsInstalled(true);
            setChecking(false);
        });

        // Small delay to allow injection
        const timer = setTimeout(check, 1000);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('SLT_BRIDGE_DETECTED', check);
        };
    }, []);

    if (checking) return null;

    if (isInstalled) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hidden md:flex">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Bridge Active</span>
            </div>
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
                        Install SLT Bridge
                    </h3>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        To sync return data and status updates directly from SLT Portal, you need to install the browser extension.
                    </p>
                </div>
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">1</div>
                            <span className="text-xs font-medium">Download the extension ZIP</span>
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
                        Download Extension
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
