"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Save, CheckCircle2, AlertTriangle, FileText, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
    id: string;
    projectCode: string;
    name: string;
}

interface BOQAnalysisItem {
    boqItemId: string;
    itemCode: string;
    description: string;
    unit: string;
    requiredQty: number;
    availableStock: number;
    shortfall: number;
    currentSource: string;
    recommendedSource: string;
    materialId: string | null;
}

interface BOQAnalysisResponse {
    store: { id: string; name: string; type: string };
    analysis: BOQAnalysisItem[];
}

export default function ProjectBOQAnalysis({ project, refreshProject }: { project: Project; refreshProject: () => void }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingPR, setGeneratingPR] = useState(false);
    const [data, setData] = useState<BOQAnalysisResponse | null>(null);

    const fetchAnalysis = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/boq/analyze`);
            if (res.ok) {
                setData(await res.json());
            } else {
                toast.error('Failed to load BOQ analysis');
            }
        } catch (e) {
            console.error(e);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        fetchAnalysis();
    }, [fetchAnalysis]);

    const handleApplyRecommendations = async () => {
        if (!data) return;
        setSaving(true);
        try {
            const updates = data.analysis.map(item => ({
                boqItemId: item.boqItemId,
                source: item.recommendedSource,
                materialId: item.materialId
            }));

            const res = await fetch(`/api/projects/${project.id}/boq/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                toast.success('BOQ sources updated successfully');
                fetchAnalysis();
                refreshProject();
            } else {
                toast.error('Failed to update BOQ');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error applying updates');
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePR = async () => {
        setGeneratingPR(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/boq/generate-pr`, {
                method: 'POST',
            });
            const result = await res.json();
            
            if (res.ok) {
                toast.success(result.message || 'Purchase Requisition generated successfully');
                refreshProject();
            } else {
                toast.error(result.error || 'Failed to generate PR');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error generating PR');
        } finally {
            setGeneratingPR(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!data || data.analysis.length === 0) {
        return (
            <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 border-dashed">
                <p className="text-slate-500">No material items found in the BOQ for analysis.</p>
            </div>
        );
    }

    const newCount = data.analysis.filter(i => i.recommendedSource === 'NEW').length;
    const existingCount = data.analysis.filter(i => i.recommendedSource === 'EXISTING').length;
    const mismatchCount = data.analysis.filter(i => i.currentSource !== i.recommendedSource).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-50 dark:bg-slate-800/50">
                    <CardContent className="p-4">
                        <p className="text-sm text-slate-500 font-medium">Checking Against Store</p>
                        <h3 className="text-lg font-bold">{data.store.name}</h3>
                        <Badge variant="outline" className="mt-1">{data.store.type}</Badge>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="p-4">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Available (EXISTING)</p>
                        <h3 className="text-2xl font-bold text-blue-700 dark:text-blue-300">{existingCount}</h3>
                        <p className="text-xs text-blue-500 mt-1">Items fully in stock</p>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 dark:bg-orange-900/10">
                    <CardContent className="p-4">
                        <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Shortfall (NEW)</p>
                        <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-300">{newCount}</h3>
                        <p className="text-xs text-orange-500 mt-1">Items requiring procurement</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50 dark:bg-emerald-900/10 flex flex-col justify-center items-center text-center">
                    <CardContent className="p-4 w-full">
                        <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 mb-2"
                            onClick={handleGeneratePR}
                            disabled={generatingPR || newCount === 0}
                        >
                            {generatingPR ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                            Generate PR
                        </Button>
                        <p className="text-xs text-emerald-600">For shortfall items</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div>
                        <CardTitle className="text-lg">Material Source Analysis</CardTitle>
                        <CardDescription>
                            Compares BOQ requirements against current inventory stock levels.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchAnalysis}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleApplyRecommendations}
                            disabled={mismatchCount === 0 || saving}
                            className={mismatchCount > 0 ? 'bg-blue-600 text-white' : ''}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Apply Recommendations ({mismatchCount})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Required</TableHead>
                                    <TableHead className="text-right">In Stock</TableHead>
                                    <TableHead className="text-right">Shortfall</TableHead>
                                    <TableHead>Current Source</TableHead>
                                    <TableHead>Recommendation</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.analysis.map((item) => {
                                    const isMatch = item.currentSource === item.recommendedSource;
                                    
                                    return (
                                        <TableRow key={item.boqItemId}>
                                            <TableCell className="font-medium">{item.itemCode}</TableCell>
                                            <TableCell>
                                                {item.description}
                                                <div className="text-xs text-slate-500">{item.unit}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">{item.requiredQty}</TableCell>
                                            <TableCell className="text-right text-blue-600 font-medium">{item.availableStock}</TableCell>
                                            <TableCell className="text-right">
                                                {item.shortfall > 0 ? (
                                                    <span className="text-orange-600 font-bold">{item.shortfall}</span>
                                                ) : (
                                                    <span className="text-emerald-600">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    item.currentSource === 'NEW' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                    item.currentSource === 'EXISTING' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''
                                                }>
                                                    {item.currentSource}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    item.recommendedSource === 'NEW' ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' :
                                                    'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                                }>
                                                    {item.recommendedSource === 'NEW' ? 'Procure (NEW)' : 'Issue from Stock'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {isMatch ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" title="Source mismatch" />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
