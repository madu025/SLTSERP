"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, DollarSign, Calendar } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface RevenueConfig {
    id: string;
    rtomId: string | null;
    rtom?: { id: string; rtom: string; name: string } | null;
    revenuePerSOD: number;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    circularRef: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function SODRevenueConfigPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingConfig, setEditingConfig] = useState<RevenueConfig | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        rtomId: "",
        revenuePerSOD: "10500",
        effectiveFrom: "",
        effectiveTo: "",
        circularRef: "",
        notes: "",
        hasDateRange: false
    });

    // Fetch configurations
    const { data: configs, isLoading } = useQuery<{ success: boolean; data: RevenueConfig[] }>({
        queryKey: ["sod-revenue-configs"],
        queryFn: async () => {
            const res = await fetch("/api/admin/sod-revenue");
            return res.json();
        }
    });

    // Fetch RTOMs
    const { data: rtoms } = useQuery<{ success: boolean; data: any[] }>({
        queryKey: ["opmcs"],
        queryFn: async () => {
            const res = await fetch("/api/opmcs");
            return res.json();
        }
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingConfig ? "/api/admin/sod-revenue" : "/api/admin/sod-revenue";
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
            queryClient.invalidateQueries({ queryKey: ["sod-revenue-configs"] });
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
            const res = await fetch(`/api/admin/sod-revenue?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sod-revenue-configs"] });
            toast.success("Configuration deleted");
        },
        onError: () => {
            toast.error("Failed to delete configuration");
        }
    });

    const resetForm = () => {
        setFormData({
            rtomId: "",
            revenuePerSOD: "10500",
            effectiveFrom: "",
            effectiveTo: "",
            circularRef: "",
            notes: "",
            hasDateRange: false
        });
        setEditingConfig(null);
        setShowForm(false);
    };

    const handleEdit = (config: RevenueConfig) => {
        setEditingConfig(config);
        setFormData({
            rtomId: config.rtomId || "",
            revenuePerSOD: config.revenuePerSOD.toString(),
            effectiveFrom: config.effectiveFrom ? config.effectiveFrom.split('T')[0] : "",
            effectiveTo: config.effectiveTo ? config.effectiveTo.split('T')[0] : "",
            circularRef: config.circularRef || "",
            notes: config.notes || "",
            hasDateRange: !!(config.effectiveFrom && config.effectiveTo)
        });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const submitData: any = {
            rtomId: formData.rtomId || null,
            revenuePerSOD: parseFloat(formData.revenuePerSOD),
            circularRef: formData.circularRef || null,
            notes: formData.notes || null
        };

        if (formData.hasDateRange) {
            submitData.effectiveFrom = formData.effectiveFrom || null;
            submitData.effectiveTo = formData.effectiveTo || null;
        } else {
            submitData.effectiveFrom = null;
            submitData.effectiveTo = null;
        }

        saveMutation.mutate(submitData);
    };

    const defaultConfig = configs?.data?.find(c => c.rtomId === null && !c.effectiveFrom && !c.effectiveTo);

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />

                <main className="flex-1 overflow-y-auto p-6">
                    {/* Page Title */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">SOD Revenue Configuration</h1>
                        <p className="text-sm text-slate-500 mt-1">Configure revenue amounts per Service Order by RTOM and time period</p>
                    </div>

                    {/* Default Revenue Card */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                Default Revenue per SOD
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-3xl font-bold text-slate-900">
                                        Rs. {defaultConfig?.revenuePerSOD.toLocaleString() || "10,500"}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">Applied to all RTOMs by default</p>
                                </div>
                                {defaultConfig && (
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(defaultConfig)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit Default
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configurations List */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>RTOM-Specific Revenue Rates</CardTitle>
                                <Button onClick={() => setShowForm(true)} size="sm">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Configuration
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {showForm && (
                                <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-slate-50">
                                    <h3 className="font-semibold mb-4">
                                        {editingConfig ? "Edit Configuration" : "New Configuration"}
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>RTOM (Leave blank for default)</Label>
                                            <Select value={formData.rtomId} onValueChange={(v) => setFormData({ ...formData, rtomId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select RTOM" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="">All RTOMs (Default)</SelectItem>
                                                    {rtoms?.data?.map((rtom: any) => (
                                                        <SelectItem key={rtom.id} value={rtom.id}>
                                                            {rtom.rtom} - {rtom.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Revenue per SOD (Rs.)</Label>
                                            <Input
                                                type="number"
                                                value={formData.revenuePerSOD}
                                                onChange={(e) => setFormData({ ...formData, revenuePerSOD: e.target.value })}
                                                required
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <Switch
                                                    checked={formData.hasDateRange}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, hasDateRange: checked })}
                                                />
                                                <Label>Set time period (for circular-based changes)</Label>
                                            </div>
                                        </div>

                                        {formData.hasDateRange && (
                                            <>
                                                <div>
                                                    <Label>Effective From</Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.effectiveFrom}
                                                        onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Effective To</Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.effectiveTo}
                                                        onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div>
                                            <Label>Circular Reference (Optional)</Label>
                                            <Input
                                                value={formData.circularRef}
                                                onChange={(e) => setFormData({ ...formData, circularRef: e.target.value })}
                                                placeholder="e.g., 2026/01"
                                            />
                                        </div>

                                        <div>
                                            <Label>Notes (Optional)</Label>
                                            <Textarea
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                placeholder="Additional notes..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <Button type="submit" disabled={saveMutation.isPending}>
                                            {saveMutation.isPending ? "Saving..." : "Save Configuration"}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={resetForm}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 border-b">
                                        <tr>
                                            <th className="px-4 py-2 text-left">RTOM</th>
                                            <th className="px-4 py-2 text-right">Revenue (Rs.)</th>
                                            <th className="px-4 py-2 text-left">Period</th>
                                            <th className="px-4 py-2 text-left">Circular</th>
                                            <th className="px-4 py-2 text-center">Status</th>
                                            <th className="px-4 py-2 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {configs?.data?.filter(c => c.rtomId !== null || c.effectiveFrom || c.effectiveTo).map((config) => (
                                            <tr key={config.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2">
                                                    {config.rtom ? `${config.rtom.rtom} - ${config.rtom.name}` : "All RTOMs"}
                                                </td>
                                                <td className="px-4 py-2 text-right font-semibold">
                                                    {config.revenuePerSOD.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-xs">
                                                    {config.effectiveFrom && config.effectiveTo ? (
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(config.effectiveFrom).toLocaleDateString()} - {new Date(config.effectiveTo).toLocaleDateString()}
                                                        </div>
                                                    ) : "Always"}
                                                </td>
                                                <td className="px-4 py-2 text-xs">{config.circularRef || "-"}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {config.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex gap-2 justify-center">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (confirm("Delete this configuration?")) {
                                                                    deleteMutation.mutate(config.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
}
