"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Edit, Car, Truck, Fuel, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Vehicle {
    id: string;
    registration_number: string;
    make: string;
    model: string;
    year: number;
    vehicle_type: string;
    ownership: string;
    status: string;
    site: { id: string; name: string } | null;
    driver: { id: string; first_name: string; last_name: string } | null;
}

export default function VehiclesPage() {
    const router = useRouter();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [ownershipFilter, setOwnershipFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchVehicles = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            if (ownershipFilter !== 'ALL') params.append('ownership', ownershipFilter);
            if (searchQuery) params.append('registration_number', searchQuery);
            params.append('limit', '100');

            const res = await fetch(`/api/vehicles?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setVehicles(json.data || []);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, ownershipFilter, searchQuery]);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    const totalCount = vehicles.length;
    const availableCount = vehicles.filter(v => v.status === 'AVAILABLE').length;
    const inUseCount = vehicles.filter(v => v.status === 'IN_USE').length;
    const maintenanceCount = vehicles.filter(v => v.status === 'MAINTENANCE').length;

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            AVAILABLE: 'bg-emerald-50 text-emerald-700',
            IN_USE: 'bg-blue-50 text-blue-700',
            MAINTENANCE: 'bg-amber-50 text-amber-700',
            DECOMMISSIONED: 'bg-red-50 text-red-700',
            RESERVED: 'bg-purple-50 text-purple-700',
        };
        return (
            <Badge className={cn("border-none px-1.5 py-0.2 text-[9px] font-black leading-none", colors[status] || 'bg-slate-50 text-slate-700')}>
                {status?.replace('_', ' ')}
            </Badge>
        );
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-4">
                        {/* Page Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Vehicle Management</h1>
                                <p className="text-xs text-slate-500">Manage fleet vehicles, track status and assignments.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button onClick={() => router.push('/vehicles/new')} className="flex-1 sm:flex-none h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                    <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
                                </Button>
                            </div>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Vehicles</p>
                                        <p className="text-base font-black text-slate-900">{totalCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Car className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Available</p>
                                        <p className="text-base font-black text-emerald-600">{availableCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <Car className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">In Use</p>
                                        <p className="text-base font-black text-blue-600">{inUseCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Maintenance</p>
                                        <p className="text-base font-black text-amber-600">{maintenanceCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="w-40">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white border-slate-200">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Status</SelectItem>
                                        <SelectItem value="AVAILABLE">Available</SelectItem>
                                        <SelectItem value="IN_USE">In Use</SelectItem>
                                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                        <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
                                        <SelectItem value="RESERVED">Reserved</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-40">
                                <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white border-slate-200">
                                        <SelectValue placeholder="Ownership" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Ownership</SelectItem>
                                        <SelectItem value="OWNED">Owned</SelectItem>
                                        <SelectItem value="RENTAL">Rental</SelectItem>
                                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 max-w-xs">
                                <Input
                                    placeholder="Search registration..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 text-xs rounded-lg bg-white border-slate-200"
                                />
                            </div>
                        </div>

                        {/* Vehicles Table */}
                        <div className="erp-table-container">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Vehicles...</p>
                                </div>
                            ) : vehicles.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <Car className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No vehicles found.</p>
                                    <Button onClick={() => router.push('/vehicles/new')} className="mt-3 h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                                        <Plus className="w-4 h-4 mr-1.5" /> Add Your First Vehicle
                                    </Button>
                                </div>
                            ) : (
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Registration #</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Make / Model</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Year</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Ownership</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Site</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Driver</th>
                                                <th className="px-3 py-2 text-right pr-6 w-24">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {vehicles.map((v) => (
                                                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono font-bold text-slate-900">{v.registration_number}</td>
                                                    <td className="text-slate-600 font-medium">{v.make} {v.model}</td>
                                                    <td className="text-slate-500">{v.year}</td>
                                                    <td className="text-slate-600">{v.vehicle_type}</td>
                                                    <td className="text-slate-600">{v.ownership}</td>
                                                    <td>{getStatusBadge(v.status)}</td>
                                                    <td className="text-slate-500 text-xs">{v.site?.name || '-'}</td>
                                                    <td className="text-slate-500 text-xs">{v.driver ? `${v.driver.first_name} ${v.driver.last_name}` : '-'}</td>
                                                    <td className="text-right pr-6">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => router.push(`/vehicles/${v.id}`)}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => router.push(`/vehicles/${v.id}/edit`)}
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                                title="Edit Vehicle"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ResponsiveTable>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
