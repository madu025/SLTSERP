"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface VehicleDetail {
    id: string;
    registration_number: string;
    chassis_number: string;
    engine_number: string;
    make: string;
    model: string;
    year: number;
    color: string;
    vehicle_type: string;
    ownership: string;
    status: string;
    capacity_passengers: number;
    capacity_cargo_weight_kg: number;
    capacity_cargo_volume_m3: number;
    site_id: string;
    site: { id: string; name: string; code: string } | null;
    current_driver_id: string | null;
    driver: { id: string; first_name: string; last_name: string } | null;
    latitude: number | null;
    longitude: number | null;
    registration_date: string;
    purchase_cost: number | null;
}

export default function EditVehiclePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);

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
        status: "AVAILABLE",
        capacity_passengers: 0,
        capacity_cargo_weight_kg: 0,
        capacity_cargo_volume_m3: 0,
        site_id: "",
        current_driver_id: "",
        latitude: 0,
        longitude: 0,
        registration_date: "",
        purchase_cost: 0,
    });

    useEffect(() => {
        if (id) fetchVehicle();
    }, [id]);

    const fetchVehicle = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/vehicles/${id}`);
            if (!res.ok) throw new Error('Not found');
            const json = await res.json();
            const v = json.data;
            setVehicle(v);
            setForm({
                registration_number: v.registration_number || "",
                chassis_number: v.chassis_number || "",
                engine_number: v.engine_number || "",
                make: v.make || "",
                model: v.model || "",
                year: v.year || new Date().getFullYear(),
                color: v.color || "",
                vehicle_type: v.vehicle_type || "CAR",
                ownership: v.ownership || "OWNED",
                status: v.status || "AVAILABLE",
                capacity_passengers: v.capacity_passengers || 0,
                capacity_cargo_weight_kg: v.capacity_cargo_weight_kg || 0,
                capacity_cargo_volume_m3: v.capacity_cargo_volume_m3 || 0,
                site_id: v.site_id || "",
                current_driver_id: v.current_driver_id || "",
                latitude: v.latitude || 0,
                longitude: v.longitude || 0,
                registration_date: v.registration_date ? v.registration_date.split('T')[0] : "",
                purchase_cost: v.purchase_cost || 0,
            });
        } catch (error) {
            console.error(error);
            alert('Failed to load vehicle');
            router.push('/vehicles');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/vehicles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || 'Failed to update vehicle');
                return;
            }
            router.push(`/vehicles/${id}`);
        } catch (error) {
            console.error(error);
            alert('Error updating vehicle');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar /><main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header /><div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="max-w-3xl mx-auto py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Vehicle...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => router.push(`/vehicles/${id}`)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Edit Vehicle</h1>
                                <p className="text-xs text-slate-500">{form.registration_number || vehicle?.registration_number}</p>
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
                                                <Input required value={form.registration_number} onChange={(e) => setForm({...form, registration_number: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
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
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</Label>
                                                <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                                                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="AVAILABLE">Available</SelectItem>
                                                        <SelectItem value="IN_USE">In Use</SelectItem>
                                                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                                        <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                                                        <SelectItem value="RESERVED">Reserved</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Date</Label>
                                                <Input type="date" value={form.registration_date} onChange={(e) => setForm({...form, registration_date: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purchase Cost (LKR)</Label>
                                                <Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({...form, purchase_cost: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
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
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Assignment & Location</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Site ID *</Label>
                                                <Input required value={form.site_id} onChange={(e) => setForm({...form, site_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Enter site ID" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Driver ID</Label>
                                                <Input value={form.current_driver_id} onChange={(e) => setForm({...form, current_driver_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Optional driver ID" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latitude</Label>
                                                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({...form, latitude: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Longitude</Label>
                                                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({...form, longitude: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button type="button" variant="outline" onClick={() => router.push(`/vehicles/${id}`)} className="h-10 px-6 rounded-lg text-xs font-bold">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving} className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                                    {saving ? (
                                        <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="w-4 h-4 mr-1.5" /> Save Changes</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
