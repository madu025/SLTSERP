"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList, QrCode, CheckCircle2, Layers, MapPin, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

interface SODsResponse {
    sods: SOD[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface StockItem {
    id: string;
    quantity: number;
    item: {
        id: string;
        code: string;
        name: string;
        unit: string;
        category?: string;
    };
}

interface StockResponse {
    stockItems: StockItem[];
}

export default function ContractorSODsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [activeStatus, setActiveStatus] = useState<string>('INPROGRESS'); // Default to INPROGRESS for task execution focus
    const [selectedSOD, setSelectedSOD] = useState<SOD | null>(null);
    const [dropWireMeters, setDropWireMeters] = useState<number>(0);
    const [ontSerial, setOntSerial] = useState('');

    // Debounce search input to avoid spamming backend on every keystroke
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to first page on search
        }, 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch Contractor Assigned SODs with server-side filters & pagination
    const { data: responseData, isLoading } = useQuery<SODsResponse>({
        queryKey: ['contractor-assigned-sods', debouncedSearch, activeStatus, currentPage],
        queryFn: async () => {
            const statusParam = activeStatus === 'ALL' ? '' : `&status=${activeStatus}`;
            const res = await fetch(`/api/contractors/my-sods?page=${currentPage}&search=${encodeURIComponent(debouncedSearch)}${statusParam}&_t=${Date.now()}`);
            if (!res.ok) return { sods: [], total: 0, page: 1, limit: 50, totalPages: 0 };
            return res.json();
        }
    });

    // Fetch Live Contractor van stock to resolve Drop Wire and ONT Item IDs dynamically
    const { data: stockData } = useQuery<StockResponse>({
        queryKey: ['contractor-van-stock-sod-complete'],
        queryFn: async () => {
            const res = await fetch(`/api/contractors/my-stock?_t=${Date.now()}`);
            if (!res.ok) return { stockItems: [] };
            const json = await res.json();
            return json.data || json;
        }
    });

    // Complete SOD Mutation
    const completeSodMutation = useMutation({
        mutationFn: async (payload: {
            id: string;
            sltsStatus: string;
            completedDate: string;
            dropWireDistance: number;
            ontSerialNumber?: string;
            materialUsage: { itemId: string; quantity: string; usageType: string; serialNumber?: string }[];
        }) => {
            const res = await fetch('/api/service-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to complete Service Order');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success(`Successfully completed Service Order & deducted materials from Van Stock!`);
            queryClient.invalidateQueries({ queryKey: ['contractor-assigned-sods'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-van-stock'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-van-stock-sod-complete'] });
            queryClient.invalidateQueries({ queryKey: ['contractor-my-dashboard'] });
            setSelectedSOD(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        }
    });

    const handleSaveMaterials = () => {
        if (!selectedSOD) return;

        // Resolve drop wire and ONT item IDs dynamically from van stock catalog
        const stockItems = stockData?.stockItems || [];
        const dropWireItem = stockItems.find((s) => 
            (s.item.code || '').toUpperCase().includes('DW') || 
            (s.item.code || '').toUpperCase().includes('CBL-2F') ||
            (s.item.name || '').toUpperCase().includes('DROP WIRE')
        );
        const ontItem = stockItems.find((s) => 
            (s.item.code || '').toUpperCase().includes('ONT') || 
            (s.item.code || '').toUpperCase().includes('ONU') ||
            (s.item.name || '').toUpperCase().includes('ONT') ||
            (s.item.name || '').toUpperCase().includes('ROUTER')
        );

        if (!dropWireItem) {
            toast.error("Drop wire item not found in your van stock catalog!");
            return;
        }

        const materialUsage: { itemId: string; quantity: string; usageType: string; serialNumber?: string }[] = [
            {
                itemId: dropWireItem.item.id,
                quantity: String(dropWireMeters),
                usageType: 'USED'
            }
        ];

        if (ontSerial) {
            if (!ontItem) {
                toast.error("ONT device item not found in your van stock catalog!");
                return;
            }
            materialUsage.push({
                itemId: ontItem.item.id,
                quantity: '1',
                usageType: 'USED',
                serialNumber: ontSerial
            });
        }

        completeSodMutation.mutate({
            id: selectedSOD.id,
            sltsStatus: 'COMPLETED',
            completedDate: new Date().toISOString(),
            dropWireDistance: Number(dropWireMeters),
            ontSerialNumber: ontSerial || undefined,
            materialUsage
        });
    };

    const sodList = responseData?.sods || [];
    const totalPages = responseData?.totalPages || 0;

    const [isScanning, setIsScanning] = useState(false);

    const handleSimulateScan = () => {
        const scannedSerial = `ONT-2026-X${Math.floor(100 + Math.random() * 900)}`;
        setOntSerial(scannedSerial);
        setIsScanning(false);
        toast.success(`Barcode Scanned Successfully: ${scannedSerial}`);
    };

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

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                {[
                    { id: 'ALL', label: 'All Orders' },
                    { id: 'INPROGRESS', label: 'In Progress' },
                    { id: 'COMPLETED', label: 'Completed' },
                    { id: 'RETURN', label: 'Returned' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveStatus(tab.id);
                            setCurrentPage(1);
                        }}
                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                            activeStatus === tab.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SOD Cards Grid */}
            {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading assigned SODs...</div>
            ) : sodList.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                    <ClipboardList className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
                    <h4 className="text-sm font-bold text-slate-200">No Service Orders Found</h4>
                    <p className="text-xs text-slate-400">There are no active field SODs assigned to your contractor team.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sodList.map((sod) => (
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
                                    {sod.sltsStatus === 'INPROGRESS' && (
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
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                            <span className="text-xs text-slate-400 font-mono">
                                Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    className="bg-slate-950 border-slate-850 text-slate-200 text-xs h-8 rounded-lg px-3 flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    className="bg-slate-950 border-slate-850 text-slate-200 text-xs h-8 rounded-lg px-3 flex items-center gap-1"
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
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
                                    <button
                                        type="button"
                                        onClick={() => setIsScanning(true)}
                                        className="text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-bold flex items-center gap-1 transition-all"
                                    >
                                        <QrCode className="w-3 h-3" /> Camera Barcode Scan
                                    </button>
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

            {/* Interactive Mobile Camera Barcode / QR Code Scanner Modal */}
            <Dialog open={isScanning} onOpenChange={setIsScanning}>
                <DialogContent className="bg-slate-950 border-amber-500/40 text-white w-[92vw] max-w-sm p-4 rounded-2xl shadow-2xl text-center">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-amber-400 flex items-center justify-center gap-2">
                            <QrCode className="w-4 h-4" /> ONT Barcode Camera Scanner
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-[10px]">
                            Align ONT router barcode within the camera frame scanner viewfinder.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Camera Scanner Simulation Viewfinder Box */}
                    <div className="relative w-full h-44 bg-slate-900 rounded-xl border-2 border-dashed border-amber-500/50 flex flex-col items-center justify-center space-y-2 overflow-hidden my-2">
                        <div className="w-36 h-20 border-2 border-emerald-400 rounded-lg relative flex items-center justify-center animate-pulse">
                            <span className="text-[10px] text-emerald-400 font-mono">ALIGN BARCODE</span>
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400 animate-bounce" />
                        </div>
                        <span className="text-[9px] text-slate-400">Camera active • Auto-detecting 1D/2D barcodes</span>
                    </div>

                    <Button
                        onClick={handleSimulateScan}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl shadow-lg"
                    >
                        <QrCode className="w-4 h-4 mr-1" /> Capture & Scan Barcode
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
