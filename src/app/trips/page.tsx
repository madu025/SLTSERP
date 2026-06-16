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
import { Plus, Eye, Route, Truck, Users, Clock, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

interface Trip {
    id: string;
    vehicle_id: string;
    driver_id: string;
    start_location_name: string;
    end_location_name: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    actual_start_time: string | null;
    actual_end_time: string | null;
    planned_distance_km: number | null;
    actual_distance_km: number | null;
    trip_status: string;
    trip_type: string;
    fuel_consumed_liters: number | null;
    fuel_cost: number | null;
    vehicle: { id: string; registration_number: string; make: string; model: string } | null;
    driver: { id: string; first_name: string; last_name: string } | null;
    notes: string | null;
}

export default function TripsPage() {
    const router = useRouter();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTrips = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            if (searchQuery) params.append('registration_number', searchQuery);
            params.append('limit', '100');

            const res = await fetch(`/api/trips?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setTrips(json.data || []);
        } catch (error) {
            console.error('Error fetching trips:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchQuery]);

    useEffect(() => {
        fetchTrips();
    }, [fetchTrips]);

    const totalCount = trips.length;
    const plannedCount = trips.filter(t => t.trip_status === 'PLANNED').length;
    const inProgressCount = trips.filter(t => t.trip_status === 'IN_PROGRESS').length;
    const completedCount = trips.filter(t => t.trip_status === 'COMPLETED').length;

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PLANNED: 'bg-blue-50 text-blue-700',
            IN_PROGRESS: 'bg-amber-50 text-amber-700',
            COMPLETED: 'bg-emerald-50 text-emerald-700',
            CANCELLED: 'bg-red-50 text-red-700',
            DELAYED: 'bg-purple-50 text-purple-700',
        };
        return (
            <Badge className={cn("border-none px-1.5 py-0.2 text-[9px] font-black leading-none", colors[status] || 'bg-slate-50 text-slate-700')}>
                {status?.replace('_', ' ')}
            </Badge>
        );
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
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
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Trip Management</h1>
                                <p className="text-xs text-slate-500">Plan, track, and manage fleet trips and journeys.</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button onClick={() => router.push('/trips/new')} className="flex-1 sm:flex-none h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm">
                                    <Plus className="w-4 h-4 mr-1.5" /> New Trip
                                </Button>
                            </div>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Trips</p>
                                        <p className="text-base font-black text-slate-900">{totalCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Route className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Planned</p>
                                        <p className="text-base font-black text-blue-600">{plannedCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">In Progress</p>
                                        <p className="text-base font-black text-amber-600">{inProgressCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-xl border border-slate-200 bg-white">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Completed</p>
                                        <p className="text-base font-black text-emerald-600">{completedCount}</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <Users className="w-4 h-4" />
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
                                        <SelectItem value="PLANNED">Planned</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        <SelectItem value="DELAYED">Delayed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 max-w-xs">
                                <Input
                                    placeholder="Search vehicle reg..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-9 text-xs rounded-lg bg-white border-slate-200"
                                />
                            </div>
                        </div>

                        {/* Trips Table */}
                        <div className="erp-table-container">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <div className="h-8 w-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Loading Trips...</p>
                                </div>
                            ) : trips.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                    <Route className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs font-bold">No trips found.</p>
                                    <Button onClick={() => router.push('/trips/new')} className="mt-3 h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                                        <Plus className="w-4 h-4 mr-1.5" /> Plan Your First Trip
                                    </Button>
                                </div>
                            ) : (
                                <ResponsiveTable>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Vehicle</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Driver</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">From</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">To</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Scheduled</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-right pr-6 w-20">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {trips.map((t) => (
                                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="font-mono font-bold text-slate-900 text-xs">
                                                        {t.vehicle?.registration_number || t.vehicle_id?.slice(0, 8) || '-'}
                                                    </td>
                                                    <td className="text-slate-600 text-xs">
                                                        {t.driver ? `${t.driver.first_name} ${t.driver.last_name}` : '-'}
                                                    </td>
                                                    <td className="text-slate-600 text-xs max-w-[120px] truncate">{t.start_location_name}</td>
                                                    <td className="text-slate-600 text-xs max-w-[120px] truncate">{t.end_location_name}</td>
                                                    <td className="text-slate-500 text-[10px]">
                                                        {formatDateTime(t.scheduled_start_time)}
                                                    </td>
                                                    <td className="text-slate-600 text-xs">{t.trip_type}</td>
                                                    <td>{getStatusBadge(t.trip_status)}</td>
                                                    <td className="text-right pr-6">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => router.push(`/trips/${t.id}`)}
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Button>
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
