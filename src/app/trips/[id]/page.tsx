"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Square, Route, MapPin, Clock, Fuel, Gauge, Car, User } from 'lucide-react';
import { cn } from "@/lib/utils";

interface TripDetail {
    id: string;
    vehicle_id: string;
    driver_id: string;
    start_location_name: string;
    start_location_lat: number | null;
    start_location_lng: number | null;
    start_location_address: string | null;
    end_location_name: string;
    end_location_lat: number | null;
    end_location_lng: number | null;
    end_location_address: string | null;
    scheduled_start_time: string;
    actual_start_time: string | null;
    scheduled_end_time: string;
    actual_end_time: string | null;
    planned_distance_km: number | null;
    actual_distance_km: number | null;
    planned_duration_minutes: number | null;
    actual_duration_minutes: number | null;
    trip_status: string;
    trip_type: string;
    fuel_consumed_liters: number | null;
    fuel_cost: number | null;
    notes: string | null;
    vehicle: { id: string; registration_number: string; make: string; model: string; year: number } | null;
    driver: { id: string; first_name: string; last_name: string; phone: string; email: string } | null;
}

export default function TripDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [trip, setTrip] = useState<TripDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [endDialogOpen, setEndDialogOpen] = useState(false);
    const [endForm, setEndForm] = useState({
        actual_distance_km: "",
        fuel_consumed_liters: "",
        end_location_name: "",
        end_location_lat: "",
        end_location_lng: "",
        notes: "",
    });

    useEffect(() => {
        if (id) fetchTrip();
    }, [id]);

    const fetchTrip = async () => {
        try {
            const res = await fetch(`/api/trips/${id}`);
            if (!res.ok) throw new Error('Not found');
            const json = await res.json();
            setTrip(json.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartTrip = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/trips/${id}/start`, { method: 'PATCH' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || 'Failed to start trip');
                return;
            }
            fetchTrip();
        } catch (error) {
            console.error(error);
            alert('Error starting trip');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndTrip = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/trips/${id}/end`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actual_distance_km: endForm.actual_distance_km ? parseFloat(endForm.actual_distance_km) : undefined,
                    fuel_consumed_liters: endForm.fuel_consumed_liters ? parseFloat(endForm.fuel_consumed_liters) : undefined,
                    end_location_name: endForm.end_location_name || undefined,
                    end_location_lat: endForm.end_location_lat ? parseFloat(endForm.end_location_lat) : undefined,
                    end_location_lng: endForm.end_location_lng ? parseFloat(endForm.end_location_lng) : undefined,
                    notes: endForm.notes || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || 'Failed to end trip');
                return;
            }
            setEndDialogOpen(false);
            fetchTrip();
        } catch (error) {
            console.error(error);
            alert('Error ending trip');
        } finally {
            setActionLoading(false);
        }
    };

    const openEndDialog = () => {
        setEndForm({
            actual_distance_km: trip?.actual_distance_km?.toString() || "",
            fuel_consumed_liters: trip?.fuel_consumed_liters?.toString() || "",
            end_location_name: trip?.end_location_name || "",
            end_location_lat: trip?.end_location_lat?.toString() || "",
            end_location_lng: trip?.end_location_lng?.toString() || "",
            notes: trip?.notes || "",
        });
        setEndDialogOpen(true);
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PLANNED: 'bg-blue-50 text-blue-700',
            IN_PROGRESS: 'bg-amber-50 text-amber-700',
            COMPLETED: 'bg-emerald-50 text-emerald-700',
            CANCELLED: 'bg-red-50 text-red-700',
            DELAYED: 'bg-purple-50 text-purple-700',
        };
        return (
            <Badge className={cn("border-none px-2 py-0.5 text-[10px] font-black leading-none", colors[status] || 'bg-slate-50 text-slate-700')}>
                {status?.replace('_', ' ')}
            </Badge>
        );
    };

    const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
            <span className="text-sm font-medium text-slate-800 text-right">{value || '-'}</span>
        </div>
    );

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar /><main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header /><div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        <div className="max-w-4xl mx-auto py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Trip...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar /><main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header /><div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="max-w-4xl mx-auto py-20 text-center text-slate-400">
                            <Route className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">Trip not found</p>
                            <Button onClick={() => router.push('/trips')} className="mt-3 h-8 px-4 bg-blue-600 text-white rounded-lg text-xs">Back to Trips</Button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const isPlanned = trip.trip_status === 'PLANNED';
    const isInProgress = trip.trip_status === 'IN_PROGRESS';
    const isCompleted = trip.trip_status === 'COMPLETED';

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => router.push('/trips')} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Trip Details</h1>
                                        {getStatusBadge(trip.trip_status)}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {trip.vehicle?.registration_number} - {trip.start_location_name} to {trip.end_location_name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {isPlanned && (
                                    <Button onClick={handleStartTrip} disabled={actionLoading} className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs">
                                        <Play className="w-3.5 h-3.5 mr-1.5" /> {actionLoading ? 'Starting...' : 'Start Trip'}
                                    </Button>
                                )}
                                {isInProgress && (
                                    <Button onClick={openEndDialog} disabled={actionLoading} className="h-8 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs">
                                        <Square className="w-3.5 h-3.5 mr-1.5" /> End Trip
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Trip Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Vehicle & Driver */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5" /> Vehicle & Driver
                                    </h3>
                                    <DetailRow label="Vehicle" value={trip.vehicle ? `${trip.vehicle.registration_number} (${trip.vehicle.make} ${trip.vehicle.model})` : '-'} />
                                    <DetailRow label="Driver" value={trip.driver ? `${trip.driver.first_name} ${trip.driver.last_name}` : '-'} />
                                    <DetailRow label="Driver Phone" value={trip.driver?.phone || '-'} />
                                    <DetailRow label="Trip Type" value={trip.trip_type?.replace(/_/g, ' ')} />
                                </CardContent>
                            </Card>

                            {/* Schedule */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" /> Schedule
                                    </h3>
                                    <DetailRow label="Scheduled Start" value={formatDateTime(trip.scheduled_start_time)} />
                                    <DetailRow label="Actual Start" value={formatDateTime(trip.actual_start_time)} />
                                    <DetailRow label="Scheduled End" value={formatDateTime(trip.scheduled_end_time)} />
                                    <DetailRow label="Actual End" value={formatDateTime(trip.actual_end_time)} />
                                    <DetailRow label="Planned Duration" value={trip.planned_duration_minutes ? `${trip.planned_duration_minutes} min` : '-'} />
                                    <DetailRow label="Actual Duration" value={trip.actual_duration_minutes ? `${trip.actual_duration_minutes} min` : '-'} />
                                </CardContent>
                            </Card>

                            {/* Start Location */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Start Location
                                    </h3>
                                    <DetailRow label="Location" value={trip.start_location_name} />
                                    <DetailRow label="Address" value={trip.start_location_address || '-'} />
                                    {trip.start_location_lat && trip.start_location_lng && (
                                        <DetailRow label="Coordinates" value={`${trip.start_location_lat.toFixed(6)}, ${trip.start_location_lng.toFixed(6)}`} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* End Location */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-red-600" /> End Location
                                    </h3>
                                    <DetailRow label="Location" value={trip.end_location_name} />
                                    <DetailRow label="Address" value={trip.end_location_address || '-'} />
                                    {trip.end_location_lat && trip.end_location_lng && (
                                        <DetailRow label="Coordinates" value={`${trip.end_location_lat.toFixed(6)}, ${trip.end_location_lng.toFixed(6)}`} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Distance & Fuel */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Gauge className="w-3.5 h-3.5" /> Distance & Fuel
                                    </h3>
                                    <DetailRow label="Planned Distance" value={trip.planned_distance_km ? `${trip.planned_distance_km} km` : '-'} />
                                    <DetailRow label="Actual Distance" value={trip.actual_distance_km ? `${trip.actual_distance_km} km` : '-'} />
                                    <DetailRow label="Fuel Consumed" value={trip.fuel_consumed_liters ? `${trip.fuel_consumed_liters} L` : '-'} />
                                    <DetailRow label="Fuel Cost" value={trip.fuel_cost ? `LKR ${trip.fuel_cost.toLocaleString()}` : '-'} />
                                </CardContent>
                            </Card>

                            {/* Notes */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Fuel className="w-3.5 h-3.5" /> Notes
                                    </h3>
                                    <p className="text-sm text-slate-700">{trip.notes || 'No notes recorded.'}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            {/* End Trip Dialog */}
            <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900">Complete Trip</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">Record trip completion details.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual Distance (km)</Label>
                            <Input type="number" step="0.1" value={endForm.actual_distance_km} onChange={(e) => setEndForm({...endForm, actual_distance_km: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fuel Consumed (Liters)</Label>
                            <Input type="number" step="0.1" value={endForm.fuel_consumed_liters} onChange={(e) => setEndForm({...endForm, fuel_consumed_liters: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Location Name</Label>
                            <Input value={endForm.end_location_name} onChange={(e) => setEndForm({...endForm, end_location_name: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latitude</Label>
                                <Input type="number" step="any" value={endForm.end_location_lat} onChange={(e) => setEndForm({...endForm, end_location_lat: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Longitude</Label>
                                <Input type="number" step="any" value={endForm.end_location_lng} onChange={(e) => setEndForm({...endForm, end_location_lng: e.target.value})} className="h-10 rounded-lg bg-slate-50 border-none" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</Label>
                            <textarea
                                value={endForm.notes}
                                onChange={(e) => setEndForm({...endForm, notes: e.target.value})}
                                className="w-full h-20 rounded-lg bg-slate-50 border-none p-3 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Trip completion notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleEndTrip} disabled={actionLoading} className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11 rounded-lg font-bold text-xs uppercase tracking-wider">
                            {actionLoading ? 'Completing...' : 'Complete Trip'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
