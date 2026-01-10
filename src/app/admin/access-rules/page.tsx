"use client";

import { useState, useEffect } from "react";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Lock, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

// System Sections/Modules
const SYSTEM_SECTIONS = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'service_orders', name: 'Service Orders', icon: '📋' },
    { id: 'contractors', name: 'Contractors', icon: '👷' },
    { id: 'restore_requests', name: 'Restore Requests', icon: '🔧' },
    { id: 'invoices', name: 'Invoices', icon: '💰' },
    { id: 'inventory', name: 'Inventory / Stores', icon: '📦' },
    { id: 'procurement', name: 'Procurement', icon: '🛒' },
    { id: 'administration', name: 'Administration', icon: '⚙️' }
];

// Category Access Rules (predefined based on our system design)
const ACCESS_RULES: Record<string, string[]> = {
    'ADMIN': ['dashboard', 'service_orders', 'contractors', 'restore_requests', 'invoices', 'inventory', 'procurement', 'administration'],
    'OSP_PROJECTS': ['dashboard', 'service_orders', 'contractors'],
    'NEW_CONNECTION': ['dashboard', 'service_orders', 'contractors'],
    'SERVICE_ASSURANCE': ['dashboard', 'restore_requests'],
    'STORES': ['dashboard', 'inventory'],
    'PROCUREMENT': ['dashboard', 'procurement', 'inventory'],
    'FINANCE': ['dashboard', 'invoices'],
    'INVOICE': ['dashboard', 'invoices'],
    'OFFICE_ADMIN': ['dashboard', 'contractors', 'administration']
};

const CATEGORIES = [
    { key: 'ADMIN', name: 'Administration', color: 'bg-purple-100 text-purple-700' },
    { key: 'OSP_PROJECTS', name: 'OSP Projects', color: 'bg-blue-100 text-blue-700' },
    { key: 'NEW_CONNECTION', name: 'New Connection', color: 'bg-green-100 text-green-700' },
    { key: 'SERVICE_ASSURANCE', name: 'Service Assurance', color: 'bg-orange-100 text-orange-700' },
    { key: 'STORES', name: 'Stores', color: 'bg-amber-100 text-amber-700' },
    { key: 'PROCUREMENT', name: 'Procurement', color: 'bg-cyan-100 text-cyan-700' },
    { key: 'FINANCE', name: 'Finance', color: 'bg-emerald-100 text-emerald-700' },
    { key: 'INVOICE', name: 'Invoice', color: 'bg-indigo-100 text-indigo-700' },
    { key: 'OFFICE_ADMIN', name: 'Office Admin', color: 'bg-slate-100 text-slate-700' }
];

export default function AccessRulesPage() {
    const router = useRouter();

    // Access check
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
                router.push('/dashboard');
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    const hasAccess = (category: string, section: string) => {
        return ACCESS_RULES[category]?.includes(section) || false;
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Access Rules & Permissions</h1>
                            <p className="text-slate-500">Configure which sections each user category can access</p>
                        </div>

                        {/* Info Card */}
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-blue-900">Category-Based Access Control</p>
                                        <p className="text-xs text-blue-800">
                                            Access rules are defined per category. All users within a category inherit these permissions.
                                            For example, users in "Stores" category can only access Dashboard and Inventory sections.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Access Matrix */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Access Matrix</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Category</th>
                                                {SYSTEM_SECTIONS.map(section => (
                                                    <th key={section.id} className="px-4 py-3 text-center font-semibold">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-lg">{section.icon}</span>
                                                            <span className="text-xs">{section.name}</span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {CATEGORIES.map(category => (
                                                <tr key={category.key} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <Badge className={category.color} variant="secondary">
                                                            {category.name}
                                                        </Badge>
                                                    </td>
                                                    {SYSTEM_SECTIONS.map(section => {
                                                        const access = hasAccess(category.key, section.id);
                                                        return (
                                                            <td key={section.id} className="px-4 py-3 text-center">
                                                                {access ? (
                                                                    <div className="flex justify-center">
                                                                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                                                            <Check className="w-4 h-4 text-green-600" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-center">
                                                                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                                                                            <X className="w-4 h-4 text-red-600" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Category Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {CATEGORIES.map(category => {
                                const accessibleSections = SYSTEM_SECTIONS.filter(s => hasAccess(category.key, s.id));
                                return (
                                    <Card key={category.key}>
                                        <CardHeader className="pb-3">
                                            <Badge className={category.color} variant="secondary">
                                                {category.name}
                                            </Badge>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-slate-600 uppercase">Accessible Sections:</p>
                                                <div className="space-y-1">
                                                    {accessibleSections.map(section => (
                                                        <div key={section.id} className="flex items-center gap-2 text-sm">
                                                            <Check className="w-3 h-3 text-green-600" />
                                                            <span>{section.icon} {section.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-2 border-t mt-3">
                                                    <p className="text-xs text-slate-500">
                                                        <span className="font-semibold">{accessibleSections.length}</span> of {SYSTEM_SECTIONS.length} sections accessible
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
