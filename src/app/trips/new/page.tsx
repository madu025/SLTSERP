"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

export default function NewTripPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        vehicle_id: "",
        driver_id: "",
        start_location_name: "",
        start_location_lat: "",
        start_location_lng: "",
        start_location_address: "",
        end_location_name: "",
        end_location_lat: "",
        end_location_lng: "",
        end_location_address: "",
        scheduled_start_time: "",
        scheduled_end_time: "",
        planned_distance_km: "",
        planned_duration_minutes: "",
        trip_type: "GENERAL",
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.vehicle_id || !form.driver_id || !form.start_location_name || !form.end_location_name || !form.scheduled_start_time || !form.scheduled_end_time) {
            alert("Please fill in all required fields");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/trips", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vehicle_id: form.vehicle_id,
                    driver_id: form.driver_id,
                    start_location_name: form.start_location_name,
                    start_location_lat: form.start_location_lat ? parseFloat(form.start_location_lat) : undefined,
                    start_location_lng: form.start_location_lng ? parseFloat(form.start_location_lng) : undefined,
                    start_location_address: form.start_location_address || undefined,
                    end_location_name: form.end_location_name,
                    end_location_lat: form.end_location_lat ? parseFloat(form.end_location_lat) : undefined,
                    end_location_lng: form.end_location_lng ? parseFloat(form.end_location_lng) : undefined,
                    end_location_address: form.end_location_address || undefined,
                    scheduled_start_time: form.scheduled_start_time,
                    scheduled_end_time: form.scheduled_end_time,
                    planned_distance_km: form.planned_distance_km ? parseFloat(form.planned_distance_km) : undefined,
                    planned_duration_minutes: form.planned_duration_minutes ? parseInt(form.planned_duration_minutes) : undefined,
                    trip_type: form.trip_type,
                    notes: form.notes || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || "Failed to create trip");
                return;
            }
            router.push("/trips");
        } catch (error) {
            console.error(error);
            alert("Error creating trip");
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
                            <Button variant="ghost" onClick={() => router.push("/trips")} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Plan New Trip</h1>
                                <p className="text-xs text-slate-500">Schedule a new trip with vehicle and driver assignment.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-6 space-y-6">
                                    {/* Assignment */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Assignment</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle ID *</Label>
                                                <Input required value={form.vehicle_id} onChange={(e) => setForm({...form, vehicle_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Enter vehicle ID" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver ID *</Label>
                                                <Input required value={form.driver_id} onChange={(e) => setForm({...form, driver_id: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Enter driver ID" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trip Details */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Trip Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trip Type</Label>
                                                <Select value={form.trip_type} onValueChange={(v) => setForm({...form, trip_type: v})}>
                                                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="GENERAL">General</SelectItem>
                                                        <SelectItem value="MATERIAL_DELIVERY">Material Delivery</SelectItem>
                                                        <SelectItem value="PASSENGER_TRANSFER">Passenger Transfer</SelectItem>
                                                        <SelectItem value="FIELD_SERVICE">Field Service</SelectItem>
                                                        <SelectItem value="MAINTENANCE_RUN">Maintenance Run</SelectItem>
                                                        <SelectItem value="OTHER">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planned Distance (km)</Label>
                                                <Input type="number" step="0.1" value={form.planned_distance_km} onChange={(e) => setForm({...form, planned_distance_km: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Start Location */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Start Location</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Name *</Label>
                                                <Input required value={form.start_location_name} onChange={(e) => setForm({...form, start_location_name: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="e.g. Head Office - Colombo" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latitude</Label>
                                                <Input type="number" step="any" value={form.start_location_lat} onChange={(e) => setForm({...form, start_location_lat: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Longitude</Label>
                                                <Input type="number" step="any" value={form.start_location_lng} onChange={(e) => setForm({...form, start_location_lng: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5 md:col-span-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Address</Label>
                                                <Input value={form.start_location_address} onChange={(e) => setForm({...form, start_location_address: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Full address (optional)" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* End Location */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">End Location</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Name *</Label>
                                                <Input required value={form.end_location_name} onChange={(e) => setForm({...form, end_location_name: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="e.g. Kandy Branch" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latitude</Label>
                                                <Input type="number" step="any" value={form.end_location_lat} onChange={(e) => setForm({...form, end_location_lat: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Longitude</Label>
                                                <Input type="number" step="any" value={form.end_location_lng} onChange={(e) => setForm({...form, end_location_lng: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5 md:col-span-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Address</Label>
                                                <Input value={form.end_location_address} onChange={(e) => setForm({...form, end_location_address: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" placeholder="Full address (optional)" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Schedule */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Schedule</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Start *</Label>
                                                <Input required type="datetime-local" value={form.scheduled_start_time} onChange={(e) => setForm({...form, scheduled_start_time: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled End *</Label>
                                                <Input required type="datetime-local" value={form.scheduled_end_time} onChange={(e) => setForm({...form, scheduled_end_time: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planned Duration (min)</Label>
                                                <Input type="number" value={form.planned_duration_minutes} onChange={(e) => setForm({...form, planned_duration_minutes: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Notes</h3>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trip Notes (Optional)</Label>
                                            <textarea
                                                value={form.notes}
                                                onChange={(e) => setForm({...form, notes: e.target.value})}
                                                className="w-full h-20 rounded-lg bg-slate-50 border-none p-3 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="Any special instructions or notes for this trip..."
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button type="button" variant="outline" onClick={() => router.push("/trips")} className="h-10 px-6 rounded-lg text-xs font-bold">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading} className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                                    <Save className="w-4 h-4 mr-1.5" /> {loading ? "Saving..." : "Create Trip"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
