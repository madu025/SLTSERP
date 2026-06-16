"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Car } from 'lucide-react';

interface Vehicle { id: string; plate_number: string; status: string; }

export default function VehicleManagementSummary() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/vehicles?limit=5')
            .then(r => r.json())
            .then(d => { setVehicles(d.data || d || []); })
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, []);

    const totalVehicles = vehicles.length;
    const availableCount = vehicles.filter(v => v.status === 'AVAILABLE').length;
    const inUseCount = vehicles.filter(v => v.status === 'IN_USE' || v.status === 'BOOKED').length;
    const maintenanceCount = vehicles.filter(v => v.status === 'MAINTENANCE' || v.status === 'UNDER_MAINTENANCE').length;

    return (
        <Card className="rounded-xl border border-slate-200 bg-white h-full">
            <CardContent className="p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-600" /> Vehicle Summary
                </h3>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                        <div className="h-5 w-5 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                                <p className="text-lg font-black text-slate-900">{totalVehicles}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Total</p>
                            </div>
                            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                                <p className="text-lg font-black text-emerald-600">{availableCount}</p>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase">Available</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                                <p className="text-lg font-black text-blue-600">{inUseCount}</p>
                                <p className="text-[10px] font-bold text-blue-600 uppercase">In Use</p>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                                <p className="text-lg font-black text-amber-600">{maintenanceCount}</p>
                                <p className="text-[10px] font-bold text-amber-600 uppercase">Maintenance</p>
                            </div>
                        </div>
                        {vehicles.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Recent Vehicles</p>
                                <div className="space-y-1">
                                    {vehicles.map(v => (
                                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50">
                                            <span className="text-xs font-bold text-slate-700 font-mono">{v.plate_number}</span>
                                            <span className={
                                                v.status === 'AVAILABLE' ? 'text-[10px] font-bold text-emerald-600' :
                                                v.status === 'IN_USE' || v.status === 'BOOKED' ? 'text-[10px] font-bold text-blue-600' :
                                                'text-[10px] font-bold text-amber-600'
                                            }>{v.status?.replace(/_/g, ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
