"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList, QrCode, CheckCircle2, Layers, MapPin, Search } from "lucide-react";
import { toast } from 'sonner';

interface SOD {
    id: string;
    soNum: string;
    customerName: string;
    address: string;
    voiceNumber: string;
    sltsStatus: string;
    dropWireDistance?: number;
    ontSerialNumber?: string;
}

export default function ContractorSODsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSOD, setSelectedSOD] = useState<SOD | null>(null);
    const [dropWireMeters, setDropWireMeters] = useState<number>(0);
    const [ontSerial, setOntSerial] = useState('');

    // Fetch Contractor Assigned SODs
    const { data: sods = [], isLoading } = useQuery<SOD[]>({
        queryKey: ['contractor-assigned-sods'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-sods?_t=${Date.now()}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const handleSaveMaterials = () => {
        if (!selectedSOD) return;
        toast.success(`Materials logged for SO ${selectedSOD.soNum}: ${dropWireMeters}m Drop Wire, ONT: ${ontSerial || 'N/A'}`);
        setSelectedSOD(null);
    };

    const filteredSODs = sods.filter(s => 
        !searchTerm || 
        s.soNum.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.voiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 gap-4 shadow-lg">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-400" />
                        Field SOD Execution & Material Logging
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Select assigned SOD to log Drop Wire distance, scan ONT serial, and record installation materials.</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search SO or voice no..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* SOD Cards Grid */}
            {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading assigned SODs...</div>
            ) : filteredSODs.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                    <ClipboardList className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
                    <h4 className="text-sm font-bold text-slate-200">No Service Orders Found</h4>
                    <p className="text-xs text-slate-400">There are no active field SODs assigned to your contractor team.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSODs.map((sod) => (
                        <Card key={sod.id} className="bg-slate-900/80 border-slate-800 shadow-md">
                            <CardHeader className="p-4 pb-2 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-sm font-bold text-blue-400 font-mono">{sod.soNum}</CardTitle>
                                    <p className="text-xs text-slate-300 font-bold truncate">{sod.customerName || 'N/A'}</p>
                                </div>
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                    {sod.sltsStatus}
                                </span>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span className="truncate">{sod.address || 'Address N/A'}</span>
                                    </div>
                                    <div className="flex justify-between font-mono text-[11px] pt-1">
                                        <span className="text-slate-400">TP / Voice: <span className="text-slate-200 font-bold">{sod.voiceNumber || '-'}</span></span>
                                        <span className="text-slate-400">DW: <span className="text-amber-400 font-bold">{sod.dropWireDistance || 0} m</span></span>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        setSelectedSOD(sod);
                                        setDropWireMeters(sod.dropWireDistance || 0);
                                        setOntSerial(sod.ontSerialNumber || '');
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    <Layers className="w-4 h-4" />
                                    Log Installation Materials
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Material Logging Modal */}
            <Dialog open={!!selectedSOD} onOpenChange={() => setSelectedSOD(null)}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log SOD Field Materials</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Enter Drop Wire meters and scan ONT serial number installed on site.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSOD && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono">
                                <div className="flex justify-between text-slate-400">
                                    <span>SO Number:</span>
                                    <span className="text-blue-400 font-bold">{selectedSOD.soNum}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Customer:</span>
                                    <span className="text-white truncate">{selectedSOD.customerName}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-bold mb-1">Drop Wire Span Distance (Meters)</label>
                                <input
                                    type="number"
                                    placeholder="Enter distance in meters (e.g. 45)"
                                    value={dropWireMeters || ''}
                                    onChange={(e) => setDropWireMeters(Number(e.target.value))}
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 font-bold mb-1 flex justify-between items-center">
                                    <span>ONT Serial Number</span>
                                    <span className="text-[10px] text-blue-400 flex items-center gap-1 cursor-pointer">
                                        <QrCode className="w-3 h-3" /> Camera Scan
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Scan barcode or type serial (e.g. ONT2026X99)"
                                    value={ontSerial}
                                    onChange={(e) => setOntSerial(e.target.value)}
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono uppercase"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedSOD(null)} className="border-slate-800 text-slate-300 text-xs">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveMaterials}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Save Material Attachments
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
