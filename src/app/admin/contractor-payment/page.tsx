"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ShieldCheck, Ruler, Trash } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface Tier {
    id?: string;
    minDistance: number;
    maxDistance: number;
    amount: number;
}

interface ContractorPaymentConfig {
    id: string;
    rtomId: string | null;
    rtom?: { id: string; rtom: string; name: string } | null;
    tiers: Tier[];
    notes: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function ContractorPaymentConfigPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingConfig, setEditingConfig] = useState<ContractorPaymentConfig | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        rtomId: "",
        notes: "",
        isActive: true
    });
    const [tiers, setTiers] = useState<Tier[]>([
        { minDistance: 0, maxDistance: 99, amount: 8000 },
        { minDistance: 100, maxDistance: 200, amount: 9500 },
        { minDistance: 201, maxDistance: 300, amount: 11000 },
        { minDistance: 301, maxDistance: 400, amount: 12500 },
        { minDistance: 401, maxDistance: 500, amount: 14000 },
        { minDistance: 501, maxDistance: 9999, amount: 16000 }
    ]);

    // Fetch configurations
    const { data: configs, isLoading } = useQuery<{ success: boolean; data: ContractorPaymentConfig[] }>({
        queryKey: ["contractor-payment-configs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/contractor-payment");
            return res.json();
        }
    });

    // Fetch RTOMs
    const { data: rtoms } = useQuery<any[]>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const res = await fetch("/api/opmcs");
            return res.json();
        }
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = "/api/admin/contractor-payment";
            const method = editingConfig ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingConfig ? { id: editingConfig.id, ...data } : data)
            });
            if (!res.ok) throw new Error("Failed to save configuration");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractor-payment-configs"] });
            toast.success(editingConfig ? "Configuration updated" : "Configuration created");
            resetForm();
        },
        onError: () => {
            toast.error("Failed to save configuration");
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/contractor-payment?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contractor-payment-configs"] });
            toast.success("Configuration deleted");
        },
        onError: () => {
            toast.error("Failed to delete configuration");
        }
    });

    const resetForm = () => {
        setFormData({
            rtomId: "GLOBAL",
            notes: "",
            isActive: true
        });
        setTiers([
            { minDistance: 0, maxDistance: 99, amount: 8000 },
            { minDistance: 100, maxDistance: 200, amount: 9500 },
            { minDistance: 201, maxDistance: 300, amount: 11000 },
            { minDistance: 301, maxDistance: 400, amount: 12500 },
            { minDistance: 401, maxDistance: 500, amount: 14000 },
            { minDistance: 501, maxDistance: 9999, amount: 16000 }
        ]);
        setEditingConfig(null);
        setShowForm(false);
    };

    const handleEdit = (config: ContractorPaymentConfig) => {
        setEditingConfig(config);
        setFormData({
            rtomId: config.rtomId || "GLOBAL",
            notes: config.notes || "",
            isActive: config.isActive
        });
        setTiers(config.tiers.map(t => ({
            id: t.id,
            minDistance: t.minDistance,
            maxDistance: t.maxDistance,
            amount: t.amount
        })));
        setShowForm(true);
    };

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const nextMin = lastTier ? lastTier.maxDistance + 1 : 0;
        setTiers([...tiers, { minDistance: nextMin, maxDistance: nextMin + 100, amount: 0 }]);
    };

    const removeTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index));
    };

    const updateTier = (index: number, field: keyof Tier, value: string) => {
        const newTiers = [...tiers];
        (newTiers[index] as any)[field] = parseFloat(value) || 0;
        setTiers(newTiers);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const submitData = {
            rtomId: formData.rtomId === "GLOBAL" ? null : formData.rtomId,
            notes: formData.notes || null,
            isActive: formData.isActive,
            tiers: tiers
        };

        saveMutation.mutate(submitData);
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Contractor Payment Configuration</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage tiered payment rates based on Drop Wire distance per RTOM</p>
                        </div>
                        {!showForm && (
                            <Button onClick={() => setShowForm(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                New Pricing Rule
                            </Button>
                        )}
                    </div>

                    {showForm && (
                        <Card className="mb-8 border-blue-100 shadow-md animate-in slide-in-from-top-4 duration-300">
                            <CardHeader className="bg-blue-50/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {editingConfig ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                                    {editingConfig ? "Edit Pricing Configuration" : "Create New Pricing Configuration"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>RTOM (Leave blank for global default)</Label>
                                            <Select value={formData.rtomId} onValueChange={(v) => setFormData({ ...formData, rtomId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select RTOM" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="GLOBAL">Global Default (All RTOMs)</SelectItem>
                                                    {rtoms?.map((rtom: any) => (
                                                        <SelectItem key={rtom.id} value={rtom.id}>
                                                            {rtom.rtom} - {rtom.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Notes (Optional)</Label>
                                            <Input
                                                placeholder="Circular ref or reason..."
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base font-bold flex items-center gap-2">
                                                <Ruler className="w-4 h-4 text-slate-400" />
                                                Distance Tiers (Meters)
                                            </Label>
                                            <Button type="button" variant="outline" size="sm" onClick={addTier}>
                                                <Plus className="w-3 h-3 mr-1" /> Add Tier
                                            </Button>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100/80 text-slate-500 font-medium">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Min (m)</th>
                                                        <th className="px-4 py-3 text-left">Max (m)</th>
                                                        <th className="px-4 py-3 text-right">Payment Amount (Rs.)</th>
                                                        <th className="px-4 py-3 text-center w-20">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {tiers.map((tier, idx) => (
                                                        <tr key={idx} className="bg-white hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <Input
                                                                    type="number"
                                                                    className="h-9 w-24 text-center font-mono"
                                                                    value={tier.minDistance}
                                                                    onChange={(e) => updateTier(idx, 'minDistance', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Input
                                                                    type="number"
                                                                    className="h-9 w-24 text-center font-mono"
                                                                    value={tier.maxDistance}
                                                                    onChange={(e) => updateTier(idx, 'maxDistance', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Input
                                                                    type="number"
                                                                    className="h-9 w-40 text-right font-mono font-bold text-blue-600"
                                                                    value={tier.amount}
                                                                    onChange={(e) => updateTier(idx, 'amount', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => removeTier(idx)}
                                                                    className="text-slate-400 hover:text-red-600"
                                                                >
                                                                    <Trash className="w-4 h-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Button type="button" variant="outline" onClick={resetForm}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                                            {saveMutation.isPending ? "Saving..." : "Save Config"}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                        {configs?.data?.map((config) => (
                            <Card key={config.id} className="overflow-hidden border-slate-200 hover:border-blue-200 transition-all shadow-sm hover:shadow-md">
                                <CardHeader className="bg-slate-50/50 px-6 py-4 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-bold">
                                                    {config.rtom ? `${config.rtom.rtom} - ${config.rtom.name}` : "Global Default (All RTOMs)"}
                                                </CardTitle>
                                                {config.notes && <p className="text-xs text-slate-500 mt-0.5">{config.notes}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                                                <Edit className="w-4 h-4 text-slate-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm("Delete this pricing rule?")) {
                                                        deleteMutation.mutate(config.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 divide-x divide-slate-100">
                                        {config.tiers.sort((a, b) => a.minDistance - b.minDistance).map((tier, idx) => (
                                            <div key={idx} className="p-4 flex flex-col items-center justify-center text-center bg-white hover:bg-slate-50/80 transition-colors">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                    {tier.maxDistance > 9000 ? `${tier.minDistance}m+` : `${tier.minDistance}-${tier.maxDistance}m`}
                                                </span>
                                                <span className="text-sm font-extrabold text-blue-600">
                                                    Rs. {tier.amount.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {configs?.data?.length === 0 && !showForm && (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-400 font-medium">No pricing rules found. Create one to get started.</p>
                                <Button className="mt-4" variant="outline" onClick={() => setShowForm(true)}>
                                    <Plus className="w-4 h-4 mr-2" /> Add First Rule
                                </Button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
