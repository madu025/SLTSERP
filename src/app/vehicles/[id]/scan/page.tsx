"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Gauge, Clock, AlertTriangle, CheckCircle, ArrowLeft, Loader2, QrCode } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  ownership: string;
  status: string;
  last_odometer: number;
  site: { id: string; name: string } | null;
  driver: { id: string; first_name: string; last_name: string } | null;
}

interface ActiveLog {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_time: string;
  start_odometer: number;
  expected_start_odometer: number;
  passengers?: string;
  driver?: { id: string; first_name: string; last_name: string } | null;
}

export default function VehicleScanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeLog, setActiveLog] = useState<ActiveLog | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Form states - Check-in
  const [driverId, setDriverId] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [passengers, setPassengers] = useState('');
  const [mismatchReason, setMismatchReason] = useState('');

  // Form states - Check-out
  const [endOdometer, setEndOdometer] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vehicles/${id}/log`);
      if (!res.ok) throw new Error('Failed to load logs');
      const json = await res.json();
      
      const data = json.data;
      setVehicle(data.vehicle);
      setActiveLog(data.activeLog);
      setDrivers(data.drivers);

      // Pre-populate fields
      if (data.vehicle) {
        setStartOdometer(String(data.vehicle.last_odometer));
        if (data.vehicle.driver) {
          setDriverId(data.vehicle.driver.id);
        }
      }
      if (data.activeLog) {
        setEndOdometer(String(data.activeLog.start_odometer));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load vehicle log information');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, fetchData]);

  const isOdometerMismatched = vehicle && Number(startOdometer) !== vehicle.last_odometer;

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) {
      toast.error('Please select a driver');
      return;
    }
    if (!startOdometer || isNaN(Number(startOdometer))) {
      toast.error('Please enter a valid start odometer');
      return;
    }
    if (isOdometerMismatched && !mismatchReason.trim()) {
      toast.error('Please enter a reason for the odometer mismatch');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/vehicles/${id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          start_odometer: Number(startOdometer),
          expected_start_odometer: vehicle?.last_odometer,
          mismatch_reason: mismatchReason,
          passengers,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to check in');
      }

      toast.success('Vehicle checked out successfully (Duty On)!');
      fetchData();
    } catch (err) {
      toast.error((err as Error).message || 'Error occurred during check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endOdometer || isNaN(Number(endOdometer))) {
      toast.error('Please enter a valid ending odometer');
      return;
    }
    if (activeLog && Number(endOdometer) < activeLog.start_odometer) {
      toast.error(`Ending odometer cannot be less than starting odometer (${activeLog.start_odometer} km)`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/vehicles/${id}/log`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_odometer: Number(endOdometer),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to check out');
      }

      toast.success('Vehicle returned successfully (Duty Off)!');
      fetchData();
    } catch (err) {
      toast.error((err as Error).message || 'Error occurred during check-out');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="erp-page-wrapper flex-row overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-wider animate-pulse">Initializing Scanner...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="erp-page-wrapper flex-row overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center justify-center text-slate-400 gap-4">
            <AlertTriangle className="h-12 w-12 text-rose-500" />
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">Scanned QR Code Invalid</h3>
              <p className="text-xs text-slate-500 mt-1">This vehicle ID is not recognized in the SLTS ERP database.</p>
            </div>
            <Button onClick={() => router.push('/vehicles')} className="h-8 text-xs bg-slate-900 text-white rounded-lg px-4">
              Back to Fleet
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const isAvailable = vehicle.status === 'AVAILABLE' || !activeLog;

  return (
    <div className="erp-page-wrapper flex-row overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="max-w-md mx-auto space-y-4">
            {/* Header / Back to fleet */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => router.push(`/vehicles/${vehicle.id}`)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-600 animate-pulse" /> QR Scan Landing
              </h1>
            </div>

            {/* Scanned Vehicle Card */}
            <Card className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <CardHeader className="p-4 bg-slate-50 border-b border-slate-100 flex-row justify-between items-center space-y-0">
                <div>
                  <CardTitle className="text-sm font-black text-slate-900">{vehicle.registration_number}</CardTitle>
                  <CardDescription className="text-[11px] font-semibold text-slate-500">{vehicle.make} {vehicle.model} ({vehicle.year})</CardDescription>
                </div>
                <Badge className={cn("border-none px-2 py-0.5 text-[9px] font-black tracking-wider uppercase", 
                  isAvailable ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                )}>
                  {isAvailable ? "Available" : "In Use"}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Site/Office</span>
                  <p className="font-semibold text-slate-700">{vehicle.site?.name || 'Unassigned'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Odometer</span>
                  <p className="font-mono font-bold text-slate-900">{vehicle.last_odometer.toLocaleString()} km</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Ownership Type</span>
                  <p className="font-semibold text-slate-700">
                    {vehicle.ownership === 'RENTAL' 
                      ? (vehicle.driver ? "Hired / Rent with Driver" : "Hired / Rent Without Driver") 
                      : "Owned SLTS Vehicle"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Check-In / Duty On Form */}
            {isAvailable ? (
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-md">
                <CardHeader className="p-4 border-b border-slate-100">
                  <CardTitle className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Start Duty (Check-In)
                  </CardTitle>
                  <CardDescription className="text-[11px]">Scanned at {new Date().toLocaleTimeString()}. Record the driver and odometer to start usage.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleCheckIn} className="space-y-4">
                    {/* Driver Selection */}
                    <div className="space-y-1.5">
                      <Label htmlFor="driver" className="text-[10px] font-black uppercase text-slate-500">Driver Name</Label>
                      <Select value={driverId} onValueChange={setDriverId}>
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200">
                          <SelectValue placeholder="Select Driver..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id} className="text-xs">
                              {d.first_name} {d.last_name} {d.phone ? `(${d.phone})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {vehicle.driver && (
                        <p className="text-[10px] text-slate-500">
                          * Defaults to vehicle&apos;s assigned driver: <strong>{vehicle.driver.first_name} {vehicle.driver.last_name}</strong>
                        </p>
                      )}
                    </div>

                    {/* Passenger details */}
                    <div className="space-y-1.5">
                      <Label htmlFor="passengers" className="text-[10px] font-black uppercase text-slate-500">Section / Passengers</Label>
                      <Input
                        id="passengers"
                        placeholder="e.g. NWP Section / NWP Team"
                        value={passengers}
                        onChange={(e) => setPassengers(e.target.value)}
                        className="h-9 text-xs rounded-xl bg-white border-slate-200"
                      />
                    </div>

                    {/* Start Odometer */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="startOdometer" className="text-[10px] font-black uppercase text-slate-500">Current Odometer (km)</Label>
                        <span className="text-[10px] font-bold text-slate-400">Expected: {vehicle.last_odometer.toLocaleString()} km</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="startOdometer"
                          type="number"
                          value={startOdometer}
                          onChange={(e) => setStartOdometer(e.target.value)}
                          className="h-9 text-xs rounded-xl bg-white border-slate-200 pl-8 font-mono font-bold"
                        />
                        <Gauge className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Odometer Mismatch Block */}
                    {isOdometerMismatched && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2 animate-fadeIn">
                        <div className="flex items-start gap-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <div>
                            <p className="uppercase">Odometer Mismatch Warning!</p>
                            <p className="font-normal mt-0.5">
                              Entered meter ({Number(startOdometer).toLocaleString()} km) differs from the vehicle&apos;s last recorded end meter ({vehicle.last_odometer.toLocaleString()} km).
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="mismatchReason" className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-400">Reason for difference</Label>
                          <textarea
                            id="mismatchReason"
                            rows={2}
                            placeholder="e.g. Odometer reading correction / local trip not logged"
                            value={mismatchReason}
                            onChange={(e) => setMismatchReason(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-white outline-none resize-none"
                          />
                        </div>
                      </div>
                    )}

                    <Button type="submit" disabled={submitting} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5">
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Starting Duty...
                        </>
                      ) : (
                        "Check In & Go"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* Check-Out / Duty Off Form */
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-md">
                <CardHeader className="p-4 border-b border-slate-100">
                  <CardTitle className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-500" /> End Duty (Check-Out)
                  </CardTitle>
                  <CardDescription className="text-[11px]">Return this vehicle and record the final ending odometer.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Current Active Log Details */}
                  <div className="p-3 bg-blue-50/50 rounded-xl space-y-2 text-xs text-slate-600 border border-blue-100/50">
                    <div className="flex justify-between">
                      <span className="font-bold">Active Driver:</span>
                      <span className="font-semibold text-slate-900">
                        {activeLog.driver ? `${activeLog.driver.first_name} ${activeLog.driver.last_name}` : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Start Time:</span>
                      <span>{new Date(activeLog.start_time).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Start Odometer:</span>
                      <span className="font-mono font-bold text-slate-900">{activeLog.start_odometer.toLocaleString()} km</span>
                    </div>
                    {activeLog.passengers && (
                      <div className="flex justify-between border-t border-blue-100/30 pt-1.5 mt-1">
                        <span className="font-bold">Section/Passengers:</span>
                        <span>{activeLog.passengers}</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleCheckOut} className="space-y-4">
                    {/* End Odometer */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="endOdometer" className="text-[10px] font-black uppercase text-slate-500">Ending Odometer (km)</Label>
                        {Number(endOdometer) >= activeLog.start_odometer && (
                          <span className="text-[10px] font-bold text-emerald-600">
                            Distance Traveled: +{(Number(endOdometer) - activeLog.start_odometer).toLocaleString()} km
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="endOdometer"
                          type="number"
                          value={endOdometer}
                          onChange={(e) => setEndOdometer(e.target.value)}
                          className="h-9 text-xs rounded-xl bg-white border-slate-200 pl-8 font-mono font-bold"
                        />
                        <Gauge className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5">
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Ending Duty...
                        </>
                      ) : (
                        "Check Out & Return"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
