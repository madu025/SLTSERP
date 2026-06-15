"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Car, MapPin, User, Building2, Gauge, DollarSign } from 'lucide-react';
import { cn } from "@/lib/utils";

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
    driver: { id: string; first_name: string; last_name: string; phone: string; email: string } | null;
    latitude: number | null;
    longitude: number | null;
    registration_date: string;
    purchase_cost: number | null;
}

export default function VehicleDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (id) {
            fetchVehicle();
        }
    }, [id]);

    const fetchVehicle = async () => {
        try {
            const res = await fetch(`/api/vehicles/${id}`);
            if (!res.ok) throw new Error('Not found');
            const json = await res.json();
            setVehicle(json.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this vehicle?')) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error?.message || 'Failed to delete');
                return;
            }
            router.push('/vehicles');
        } catch (error) {
            console.error(error);
            alert('Error deleting vehicle');
        } finally {
            setDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            AVAILABLE: 'bg-emerald-50 text-emerald-700',
            IN_USE: 'bg-blue-50 text-blue-700',
            MAINTENANCE: 'bg-amber-50 text-amber-700',
            DECOMMISSIONED: 'bg-red-50 text-red-700',
            RESERVED: 'bg-purple-50 text-purple-700',
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

    if (loading) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar /><main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header /><div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        <div className="max-w-4xl mx-auto py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Vehicle...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar /><main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header /><div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="max-w-4xl mx-auto py-20 text-center text-slate-400">
                            <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">Vehicle not found</p>
                            <Button onClick={() => router.push('/vehicles')} className="mt-3 h-8 px-4 bg-blue-600 text-white rounded-lg text-xs">Back to Vehicles</Button>
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
                    <div className="max-w-4xl mx-auto space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => router.push('/vehicles')} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-black text-slate-900 tracking-tight">{vehicle.registration_number}</h1>
                                        {getStatusBadge(vehicle.status)}
                                    </div>
                                    <p className="text-xs text-slate-500">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {vehicle.ownership === 'RENTAL' && (
                                    <Button onClick={() => router.push(`/vehicles/${vehicle.id}/rental-summary`)} className="h-8 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs">
                                        <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Rental Payment
                                    </Button>
                                )}
                                <Button onClick={() => router.push(`/vehicles/${vehicle.id}/edit`)} className="h-8 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs">
                                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                                </Button>
                                <Button onClick={handleDelete} disabled={deleting} variant="outline" className="h-8 px-4 text-red-500 border-red-200 hover:bg-red-50 rounded-lg font-bold text-xs">
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {deleting ? 'Deleting...' : 'Delete'}
                                </Button>
                            </div>
                        </div>

                        {/* Vehicle Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Registration & Identity */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Car className="w-3.5 h-3.5" /> Registration & Identity
                                    </h3>
                                    <DetailRow label="Registration #" value={vehicle.registration_number} />
                                    <DetailRow label="Chassis #" value={vehicle.chassis_number} />
                                    <DetailRow label="Engine #" value={vehicle.engine_number} />
                                    <DetailRow label="Color" value={vehicle.color} />
                                    <DetailRow label="Registration Date" value={new Date(vehicle.registration_date).toLocaleDateString()} />
                                </CardContent>
                            </Card>

                            {/* Vehicle Specs */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Gauge className="w-3.5 h-3.5" /> Specifications
                                    </h3>
                                    <DetailRow label="Make" value={vehicle.make} />
                                    <DetailRow label="Model" value={vehicle.model} />
                                    <DetailRow label="Year" value={vehicle.year} />
                                    <DetailRow label="Type" value={vehicle.vehicle_type} />
                                    <DetailRow label="Ownership" value={vehicle.ownership} />
                                </CardContent>
                            </Card>

                            {/* Capacity */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Capacity</h3>
                                    <DetailRow label="Passengers" value={`${vehicle.capacity_passengers} seats`} />
                                    <DetailRow label="Cargo Weight" value={vehicle.capacity_cargo_weight_kg ? `${vehicle.capacity_cargo_weight_kg} kg` : '-'} />
                                    <DetailRow label="Cargo Volume" value={vehicle.capacity_cargo_volume_m3 ? `${vehicle.capacity_cargo_volume_m3} m³` : '-'} />
                                    <DetailRow label="Purchase Cost" value={vehicle.purchase_cost ? `LKR ${vehicle.purchase_cost.toLocaleString()}` : '-'} />
                                </CardContent>
                            </Card>

                            {/* Assignment */}
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" /> Assignment
                                    </h3>
                                    <DetailRow label="Site" value={vehicle.site?.name || '-'} />
                                    <DetailRow label="Driver" value={vehicle.driver ? `${vehicle.driver.first_name} ${vehicle.driver.last_name}` : '-'} />
                                    {vehicle.driver && (
                                        <>
                                            <DetailRow label="Driver Phone" value={vehicle.driver.phone || '-'} />
                                            <DetailRow label="Driver Email" value={vehicle.driver.email || '-'} />
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* GPS Location */}
                            {vehicle.latitude && vehicle.longitude && (
                                <Card className="rounded-xl border border-slate-200 bg-white">
                                    <CardContent className="p-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" /> Current Location
                                        </h3>
                                        <DetailRow label="Latitude" value={vehicle.latitude.toFixed(6)} />
                                        <DetailRow label="Longitude" value={vehicle.longitude.toFixed(6)} />
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
