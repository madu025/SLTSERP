"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

interface Site {
    id: string;
    name: string;
    code: string;
}

export default function NewVehiclePage() {
    const router = useRouter();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        registration_number: "",
        chassis_number: "",
        engine_number: "",
        make: "",
        model: "",
        year: new Date().getFullYear(),
        color: "",
        vehicle_type: "CAR",
        ownership: "OWNED",
        capacity_passengers: 0,
        capacity_cargo_weight_kg: 0,
        capacity_cargo_volume_m3: 0,
        assigned_site_id: "",
    });

    useEffect(() => {
        fetch("/api/vehicles?limit=1").catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.registration_number || !form.chassis_number || !form.assigned_site_id) {
            alert("Please fill in all required fields");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/vehicles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || "Failed to create vehicle");
                return;
            }
            router.push("/vehicles");
        } catch (error) {
            console.error(error);
            alert("Error creating vehicle");
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => router.push("/vehicles")} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Add New Vehicle</h1>
                                <p className="text-xs text-slate-500">Register a new vehicle in the fleet.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-6 space-y-6">
                                    {/* Basic Information */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Basic Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Number *</Label>
                                                <Input required value={form.registration_number} onChange={(e) => setForm({...form, registration_number: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="e.g. WP-XXXX" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chassis Number *</Label>
                                                <Input required value={form.chassis_number} onChange={(e) => setForm({...form, chassis_number: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Engine Number</Label>
                                                <Input value={form.engine_number} onChange={(e) => setForm({...form, engine_number: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Make</Label>
                                                <Input value={form.make} onChange={(e) => setForm({...form, make: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="e.g. Toyota" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Model</Label>
                                                <Input value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="e.g. Hilux" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</Label>
                                                <Input type="number" value={form.year} onChange={(e) => setForm({...form, year: parseInt(e.target.value) || new Date().getFullYear()})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Color</Label>
                                                <Input value={form.color} onChange={(e) => setForm({...form, color: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle Type</Label>
                                                <Select value={form.vehicle_type} onValueChange={(v) => setForm({...form, vehicle_type: v})}>
                                                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CAR">Car</SelectItem>
                                                        <SelectItem value="VAN">Van</SelectItem>
                                                        <SelectItem value="MINI_VAN">Mini Van</SelectItem>
                                                        <SelectItem value="LORRY">Lorry</SelectItem>
                                                        <SelectItem value="CAB">Cab</SelectItem>
                                                        <SelectItem value="DOUBLE_CAB">Double Cab</SelectItem>
                                                        <SelectItem value="BOOM_TRUCK">Boom Truck</SelectItem>
                                                        <SelectItem value="TRUCK">Truck</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ownership</Label>
                                                <Select value={form.ownership} onValueChange={(v) => setForm({...form, ownership: v})}>
                                                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="OWNED">Owned</SelectItem>
                                                        <SelectItem value="RENTAL">Rental</SelectItem>
                                                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capacity */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Capacity</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passengers</Label>
                                                <Input type="number" value={form.capacity_passengers} onChange={(e) => setForm({...form, capacity_passengers: parseInt(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo Weight (kg)</Label>
                                                <Input type="number" value={form.capacity_cargo_weight_kg} onChange={(e) => setForm({...form, capacity_cargo_weight_kg: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo Volume (m³)</Label>
                                                <Input type="number" value={form.capacity_cargo_volume_m3} onChange={(e) => setForm({...form, capacity_cargo_volume_m3: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Assignment</h3>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Site *</Label>
                                            <Input required value={form.assigned_site_id} onChange={(e) => setForm({...form, assigned_site_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Site ID (enter site ID)" />
                                            <p className="text-[9px] text-slate-400 mt-1">Enter the site ID for vehicle assignment.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button type="button" variant="outline" onClick={() => router.push("/vehicles")} className="h-10 px-6 rounded-lg text-xs font-bold">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                                    <Save className="w-4 h-4 mr-1.5" /> {loading ? "Saving..." : "Save Vehicle"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}

