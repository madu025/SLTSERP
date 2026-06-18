"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MapPin, Route, Upload, Calculator, CheckCircle2, Download, MapIcon, Settings, ShoppingCart } from 'lucide-react';

import { toast } from 'sonner';
interface ProjectGISRouteProps { project: any; }

const GIS_CATEGORIES = [
    { key: "POLE", label: "Poles", icon: "🔵" },
    { key: "CHAMBER", label: "Chambers", icon: "🟢" },
    { key: "CLOSURE", label: "Closures", icon: "🟣" },
    { key: "CABLE", label: "Cables", icon: "🟡" },
] as const;

export default function ProjectGISRoute({ project }: ProjectGISRouteProps) {
    const router = useRouter();
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Material Mapping state
    const [mappingOpen, setMappingOpen] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [savingMapping, setSavingMapping] = useState(false);

    // PR Generation state
    const [generatingPR, setGeneratingPR] = useState<Record<string, boolean>>({});
    const [prResult, setPrResult] = useState<Record<string, any>>({});

    useEffect(() => { fetchRoutes(); }, [project.id]);

    const fetchRoutes = async () => {
        try {
            const res = await fetch(`/api/projects/${project.id}/gis`);
            const data = await res.json();
            setRoutes(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleGenerateBOQ = async (routeId: string) => {
        try {
            const res = await fetch(`/api/projects/${project.id}/gis/${routeId}/generate-boq`, { method: 'POST' });
            if (res.ok) fetchRoutes();
        } catch (err) { console.error(err); }
    };

    const handleOpenMapView = () => {
        router.push(`/projects/${project.id}/gis`);
    };

    // ========================================================================
    // MATERIAL MAPPING: Open dialog and load mappings + inventory items
    // ========================================================================
    const handleOpenMapping = async () => {
        try {
            const res = await fetch(`/api/projects/${project.id}/gis/mapping`);
            const data = await res.json();
            setInventoryItems(data.inventoryItems || []);
            // Convert mapping object to simple category->materialId map for Selects
            const current: Record<string, string> = {};
            if (data.mappings) {
                for (const [cat, entry] of Object.entries(data.mappings)) {
                    current[cat] = (entry as any)?.materialId || "";
                }
            }
            setMappings(current);
            setMappingOpen(true);
        } catch (err) { console.error("Failed to load mappings:", err); }
    };

    const handleSaveMapping = async () => {
        setSavingMapping(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/gis/mapping`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mappings })
            });
            if (res.ok) {
                setMappingOpen(false);
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to save mappings");
            }
        } catch (err) { console.error("Failed to save mappings:", err); }
        finally { setSavingMapping(false); }
    };

    // ========================================================================
    // ONE-CLICK PR: Generate Purchase Requisition from GIS BOQ NEW items
    // ========================================================================
    const handleGeneratePR = async (routeId: string) => {
        setGeneratingPR(prev => ({ ...prev, [routeId]: true }));
        try {
            const res = await fetch(`/api/projects/${project.id}/gis/${routeId}/generate-pr`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestedById: "system", // TODO: replace with actual logged-in user ID
                    priority: "MEDIUM"
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPrResult(prev => ({ ...prev, [routeId]: data }));
            } else {
                toast.error(data.error || "Failed to generate PR");
            }
        } catch (err) { console.error("Failed to generate PR:", err); }
        finally { setGeneratingPR(prev => ({ ...prev, [routeId]: false })); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">GIS Route Design & Auto-BOQ</h3>
                    <p className="text-sm text-slate-500">Import QGIS exports, auto-calculate quantities, generate BOQ</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={handleOpenMapping}>
                        <Settings className="w-4 h-4" /> Material Mapping
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => router.push('/gis/upload')}>
                        <Upload className="w-4 h-4" /> Import GIS
                    </Button>
                    <Button variant="default" className="gap-2" onClick={handleOpenMapView}>
                        <MapIcon className="w-4 h-4" /> Map View
                    </Button>
                </div>
            </div>

            {/* Route Stats */}
            {routes.length > 0 && routes.map((route: any) => (
                <Card key={route.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Route className="w-5 h-5 text-blue-600" />
                                <div>
                                    <CardTitle className="text-base">{route.name}</CardTitle>
                                    <p className="text-sm text-slate-500">{route.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge>{route.status}</Badge>
                                <Badge variant="outline">{route.routeLength ? `${(route.routeLength / 1000).toFixed(2)} km` : 'N/A'}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-blue-700">{route.calculatedPoles || route.poles?.length || 0}</p>
                                <p className="text-xs text-blue-600">Poles</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-700">{route.chambers?.length || 0}</p>
                                <p className="text-xs text-green-600">Chambers</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-purple-700">{route.closures?.length || 0}</p>
                                <p className="text-xs text-purple-600">Closures</p>
                            </div>
                            <div className="p-3 bg-amber-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-amber-700">{route.cableSegments?.length || 0}</p>
                                <p className="text-xs text-amber-600">Cable Segments</p>
                            </div>
                            <div className="p-3 bg-rose-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-rose-700">
                                    {route.routeLength ? `ceil(${(route.routeLength / (route.poleSpacing || 50)).toFixed(1)})` : '-'}
                                </p>
                                <p className="text-xs text-rose-600">Auto Poles</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="secondary" onClick={() => handleGenerateBOQ(route.id)}>
                                <Calculator className="w-4 h-4 mr-1" /> Generate Auto-BOQ
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleOpenMapView}>
                                <MapIcon className="w-4 h-4 mr-1" /> View on Map
                            </Button>
                            {route.gisGeneratedBOQs?.length > 0 && (
                                <>
                                    <Badge variant="secondary" className="ml-2">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> BOQ Generated
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-amber-600 hover:bg-amber-700"
                                        onClick={() => handleGeneratePR(route.id)}
                                        disabled={generatingPR[route.id]}
                                    >
                                        <ShoppingCart className="w-4 h-4 mr-1" />
                                        {generatingPR[route.id] ? "Generating PR..." : "Generate PR from BOQ"}
                                    </Button>
                                </>
                            )}
                            {prResult[route.id] && (
                                <Badge variant="default" className="bg-green-600">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    PR {prResult[route.id].prNumber} Created
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {routes.length === 0 && !loading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No GIS routes imported yet</p>
                        <Button className="mt-4" variant="outline" onClick={() => router.push('/gis/upload')}>
                            <Upload className="w-4 h-4 mr-2" /> Import Route
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ================================================================ */}
            {/* MATERIAL MAPPING DIALOG */}
            {/* ================================================================ */}
            <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Configure GIS Material Mapping</DialogTitle>
                        <DialogDescription>
                            Map each GIS layer category to a specific inventory item. This mapping
                            will be used when Auto-BOQ is generated for routes in this project.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {GIS_CATEGORIES.map(({ key, label, icon }) => (
                            <div key={key} className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {icon} {label}
                                </Label>
                                <Select
                                    value={mappings[key] || ""}
                                    onValueChange={(value) =>
                                        setMappings(prev => ({ ...prev, [key]: value }))
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select inventory item..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">— Auto-detect (default) —</SelectItem>
                                        {inventoryItems.map((item: any) => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.code} — {item.name} {item.unitPrice ? `(${item.unitPrice.toLocaleString()})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMappingOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveMapping} disabled={savingMapping}>
                            {savingMapping ? "Saving..." : "Save Mappings"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
