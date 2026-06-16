"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paintbrush, Moon, Sun, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";

const themes = [
    { name: "Cyan", value: "6 182 212", hex: "#06b6d4" },
    { name: "Blue", value: "59 130 246", hex: "#3b82f6" },
    { name: "Green", value: "34 197 94", hex: "#22c55e" },
    { name: "Orange", value: "249 115 22", hex: "#f97316" },
    { name: "Purple", value: "168 85 247", hex: "#a855f7" },
    { name: "Red", value: "239 68 68", hex: "#ef4444" },
];

export function ThemeCustomizer() {
    const { theme, setTheme } = useTheme();
    const [primaryColor, setPrimaryColor] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem("theme-primary") || "6 182 212";
        }
        return "6 182 212";
    });

    const updatePrimaryColor = (colorValue: string) => {
        setPrimaryColor(colorValue);
        localStorage.setItem("theme-primary", colorValue);
    };

    // Apply color to DOM when primaryColor changes (including on mount)
    useEffect(() => {
        document.documentElement.style.setProperty("--color-primary", primaryColor);
    }, [primaryColor]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
                    <Paintbrush className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="sr-only">Customize Theme</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant={theme === 'light' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTheme('light')}
                                className="w-full justify-start px-3"
                            >
                                <Sun className="mr-2 h-4 w-4" /> Light
                            </Button>
                            <Button
                                variant={theme === 'dark' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTheme('dark')}
                                className="w-full justify-start px-3"
                            >
                                <Moon className="mr-2 h-4 w-4" /> Dark
                            </Button>
                            <Button
                                variant={theme === 'system' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTheme('system')}
                                className="w-full justify-start px-3"
                            >
                                <Monitor className="mr-2 h-4 w-4" /> System
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Color</Label>
                        <div className="grid grid-cols-6 gap-2">
                            {themes.map((t) => (
                                <button
                                    key={t.name}
                                    onClick={() => updatePrimaryColor(t.value)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${primaryColor === t.value
                                        ? 'border-slate-900 dark:border-white scale-110'
                                        : 'border-transparent hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: t.hex }}
                                >
                                    {primaryColor === t.value && (
                                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                    )}
                                    <span className="sr-only">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
