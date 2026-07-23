"use client";

import React, { useState, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FileCheck2,
    PlusCircle,
    Calendar,
    Target,
    AlertCircle,
    FileText,
    Loader2,
    Zap,
    Trash2,
    Upload,
    FileDown,
    ExternalLink,
    Sliders,
    TrendingUp,
    ShieldAlert
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface MonthPerformance {
    month: number;
    monthName: string;
    targetVolume: number;
    actualCompleted: number;
    targetAchievementPercent: number;
    baseUnitRate: number;
    effectiveUnitRate: number;
    effectivePoleRate: number;
    effectivePerMeterRate: number;
    effectiveDistanceThreshold: number;
    customSurcharges?: Record<string, number>;
    activeAmendment: {
        amendmentNumber: string;
        reason: string;
        revisedUnitRate?: number;
        revisedTargetVolume?: number;
        revisedPoleRate?: number;
        revisedPerMeterRate?: number;
        effectiveDate: string;
        documentUrl?: string;
    } | null;
    contractedRevenue: number;
    actualRevenue: number;
    revenueVariance: number;
    status: 'EXCEEDED' | 'ON_TRACK' | 'AT_RISK' | 'CRISIS_SHORTFALL';
}

interface AnnualPerformance {
    contractId: string;
    contractNumber: string;
    title: string;
    year: number;
    startDate?: string;
    endDate?: string;
    documentUrl?: string;
    quotaStatus?: 'WITHIN_QUOTA' | 'NEARING_CAP' | 'QUOTA_EXCEEDED';
    monthlyBreakdown: MonthPerformance[];
    annualTotals: {
        totalTargetVolume: number;
        totalActualCompleted: number;
        overallAchievementPercent: number;
        totalContractedRevenue: number;
        totalActualRevenue: number;
        totalRevenueVariance: number;
    };
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SLTContractsPage() {
    const queryClient = useQueryClient();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [isCreateContractOpen, setIsCreateContractOpen] = useState(false);
    const [isCreateAmendmentOpen, setIsCreateAmendmentOpen] = useState(false);
    const [selectedContractIdForAmendment, setSelectedContractIdForAmendment] = useState<string>('');

    // Delete Confirmation Modal State
    const [contractToDelete, setContractToDelete] = useState<{ id: string; number: string; title: string } | null>(null);

    // Master Agreement Form State (Default to Blank for fresh entry)
    const [contractNumber, setContractNumber] = useState('');
    const [contractTitle, setContractTitle] = useState('');
    const [startDate, setStartDate] = useState(`${selectedYear}-01-01`);
    const [endDate, setEndDate] = useState(`${selectedYear}-12-31`);
    const [globalBaseRate, setGlobalBaseRate] = useState('');
    const [globalPole56Rate, setGlobalPole56Rate] = useState('');
    const [globalPoleRate, setGlobalPoleRate] = useState('');
    const [globalPole80Rate, setGlobalPole80Rate] = useState('');
    const [globalPoleAdminFee, setGlobalPoleAdminFee] = useState('');
    const [globalPerMeterRate, setGlobalPerMeterRate] = useState('');
    const [globalDistanceThreshold, setGlobalDistanceThreshold] = useState('');
    const [ceilingValue, setCeilingValue] = useState('');
    const [contractDocumentUrl, setContractDocumentUrl] = useState<string>('');
    const [isUploadingContractPdf, setIsUploadingContractPdf] = useState(false);

    // 12-Month Matrix State (Jan - Dec) - Blank by default
    const [monthlyTargets, setMonthlyTargets] = useState<Array<{ month: number; volume: string; rate: string }>>([
        { month: 1, volume: '', rate: '' },
        { month: 2, volume: '', rate: '' },
        { month: 3, volume: '', rate: '' },
        { month: 4, volume: '', rate: '' },
        { month: 5, volume: '', rate: '' },
        { month: 6, volume: '', rate: '' },
        { month: 7, volume: '', rate: '' },
        { month: 8, volume: '', rate: '' },
        { month: 9, volume: '', rate: '' },
        { month: 10, volume: '', rate: '' },
        { month: 11, volume: '', rate: '' },
        { month: 12, volume: '', rate: '' }
    ]);

    // Amendment Form State
    const [amendmentNumber, setAmendmentNumber] = useState('AMD-2026-01');
    const [amendmentReason, setAmendmentReason] = useState('Volume Quota Extension Addendum (Over-Achievement Cap Increase)');
    const [revisedUnitRate, setRevisedUnitRate] = useState('11500');
    const [revisedTargetVolume, setRevisedTargetVolume] = useState('10000');
    const [revisedPoleRate, setRevisedPoleRate] = useState('');
    const [revisedPerMeterRate, setRevisedPerMeterRate] = useState('');
    const [amendmentCeilingValue, setAmendmentCeilingValue] = useState('');
    const [amendmentCeilingIncrease, setAmendmentCeilingIncrease] = useState('');
    const [selectedMonthsForAmendment, setSelectedMonthsForAmendment] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const [amendmentDocumentUrl, setAmendmentDocumentUrl] = useState<string>('');
    const [isUploadingAmendmentPdf, setIsUploadingAmendmentPdf] = useState(false);
    const [isAiParsing, setIsAiParsing] = useState(false);
    const [detectedVariations, setDetectedVariations] = useState<string[]>([]);
    const aiToastId = useId();

    // Helper to reset contract form to blank
    const resetContractFormToBlank = () => {
        setContractNumber('');
        setContractTitle('');
        setStartDate(`${selectedYear}-01-01`);
        setEndDate(`${selectedYear}-12-31`);
        setGlobalBaseRate('');
        setGlobalPole56Rate('');
        setGlobalPoleRate('');
        setGlobalPole80Rate('');
        setGlobalPoleAdminFee('');
        setGlobalPerMeterRate('');
        setGlobalDistanceThreshold('');
        setCeilingValue('');
        setContractDocumentUrl('');
        setDetectedVariations([]);
        setMonthlyTargets(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, volume: '', rate: '' })));
        toast.info('Form cleared for fresh contract entry');
    };

    // Helper to apply 2026 Principal Contract default template
    const apply2026ContractTemplate = () => {
        setContractNumber('L/0733/2025');
        setContractTitle('FTTH New Connections through Sri Lanka Telecom Services (Private) Limited');
        setStartDate(`${selectedYear}-01-01`);
        setEndDate(`${selectedYear}-12-31`);
        setGlobalBaseRate('11000');
        setGlobalPole56Rate('7547.78');
        setGlobalPoleRate('10396.84');
        setGlobalPole80Rate('17369.34');
        setGlobalPoleAdminFee('500');
        setGlobalPerMeterRate('0');
        setGlobalDistanceThreshold('180');
        setMonthlyTargets(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, volume: '10000', rate: '11000' })));
        toast.success('Applied official 2026 Contract L/0733/2025 template');
    };

    // Helper to upload PDF to /api/upload & trigger AI PDF Parser
    const handleFileUpload = async (file: File, type: 'contract' | 'amendment') => {
        if (!file) return;
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
        if (!isPdf) {
            toast.error('Only PDF documents (.pdf) are allowed for agreement upload');
            return;
        }

        if (type === 'contract') setIsUploadingContractPdf(true);
        else setIsUploadingAmendmentPdf(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || json.error || 'Failed to upload PDF');
            }
            // Shared offline PDF parse call (100% local, no cloud keys)
            const runParse = async (label: string, docUrl?: string) => {
                setIsAiParsing(true);
                toast.loading(label, { id: aiToastId, duration: 20000 });

                let aiRes: Response;
                if (docUrl) {
                    aiRes = await fetch('/api/contracts/slt/ai-parse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ documentUrl: docUrl })
                    });
                } else {
                    const aiFormData = new FormData();
                    aiFormData.append('file', file);
                    aiRes = await fetch('/api/contracts/slt/ai-parse', {
                        method: 'POST',
                        body: aiFormData
                    });
                }

                const aiJson = await aiRes.json() as {
                    extracted?: Record<string, unknown> | null;
                    documentType?: string;
                    isScanned?: boolean;
                    source?: string;
                };
                toast.dismiss(aiToastId);
                return aiJson;
            };

            if (type === 'contract') {
                setContractDocumentUrl(json.url);
                toast.success('Master Agreement PDF Uploaded Successfully!');

                try {
                    const aiJson = await runParse('📄 Reading contract PDF text...', json.url);
                    const ext = (aiJson?.extracted || {}) as Record<string, unknown>;
                    const warnings = Array.isArray(ext.warnings) ? ext.warnings as string[] : [];

                    if (aiJson?.isScanned || ext.isScanned) {
                        toast.warning('⚠️ Scanned/image-only PDF detected — no readable text. Please fill fields manually or upload a digital (text) version.');
                    } else if (aiJson?.extracted) {
                        if (ext.contractNumber) setContractNumber(String(ext.contractNumber));
                        if (ext.title) setContractTitle(String(ext.title));
                        if (ext.startDate) setStartDate(String(ext.startDate));
                        if (ext.endDate) setEndDate(String(ext.endDate));
                        if (ext.baseUnitRate) setGlobalBaseRate(String(ext.baseUnitRate));
                        if (ext.poleRate56) setGlobalPole56Rate(String(ext.poleRate56));
                        if (ext.poleRate67) setGlobalPoleRate(String(ext.poleRate67));
                        if (ext.poleRate80) setGlobalPole80Rate(String(ext.poleRate80));
                        if (ext.poleAdminFee) setGlobalPoleAdminFee(String(ext.poleAdminFee));
                        if (ext.ceilingValue) setCeilingValue(String(ext.ceilingValue));
                        if (ext.distanceThresholdMeters) setGlobalDistanceThreshold(String(ext.distanceThresholdMeters));
                        if (Array.isArray(ext.monthlyTargets) && ext.monthlyTargets.length > 0) {
                            setMonthlyTargets(ext.monthlyTargets as Array<{ month: number; volume: string; rate: string }>);
                        }
                        if (Array.isArray(ext.detectedVariations)) {
                            setDetectedVariations(ext.detectedVariations as string[]);
                        }
                        toast.success('✨ PDF Contract Extracted & Form Auto-Filled Successfully!');
                    }
                    warnings.forEach(w => toast.warning(w));
                } catch (aiErr) {
                    toast.dismiss(aiToastId);
                    console.warn('[PDF_PARSE_ERR]', aiErr);
                    toast.warning('PDF parse skipped — fill details manually or use 2026 Preset');
                } finally {
                    setIsAiParsing(false);
                }
            } else {
                setAmendmentDocumentUrl(json.url);
                toast.success('Amendment Addendum PDF Uploaded Successfully!');

                try {
                    const aiJson = await runParse('📄 Reading amendment PDF text...');
                    const ext = (aiJson?.extracted || {}) as Record<string, unknown>;
                    const warnings = Array.isArray(ext.warnings) ? ext.warnings as string[] : [];
                    const amd = (ext.amendment || null) as Record<string, unknown> | null;

                    if (aiJson?.isScanned || ext.isScanned) {
                        toast.warning('⚠️ Scanned/image-only PDF detected — no readable text. Please fill amendment fields manually.');
                    } else if (amd) {
                        if (amd.amendmentNumber) setAmendmentNumber(String(amd.amendmentNumber));
                        if (amd.reason) setAmendmentReason(String(amd.reason));
                        if (amd.revisedUnitRate) setRevisedUnitRate(String(amd.revisedUnitRate));
                        if (amd.revisedTargetVolume) setRevisedTargetVolume(String(amd.revisedTargetVolume));
                        if (amd.revisedPoleRate) setRevisedPoleRate(String(amd.revisedPoleRate));
                        if (amd.ceilingValue) setAmendmentCeilingValue(String(amd.ceilingValue));
                        if (amd.ceilingIncrease) setAmendmentCeilingIncrease(String(amd.ceilingIncrease));
                        if (Array.isArray(amd.targetMonths) && amd.targetMonths.length > 0) {
                            setSelectedMonthsForAmendment(amd.targetMonths as number[]);
                        }
                        toast.success('✨ Amendment PDF Extracted & Form Auto-Filled Successfully!');
                    } else {
                        toast.info('Amendment uploaded. Could not auto-extract fields — please review manually.');
                    }
                    warnings.forEach(w => toast.warning(w));
                } catch (aiErr) {
                    toast.dismiss(aiToastId);
                    console.warn('[AMENDMENT_PARSE_ERR]', aiErr);
                    toast.warning('Amendment PDF parse skipped — fill details manually');
                } finally {
                    setIsAiParsing(false);
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'PDF Upload Failed';
            toast.error(msg);
        } finally {
            if (type === 'contract') setIsUploadingContractPdf(false);
            else setIsUploadingAmendmentPdf(false);
        }
    };

    // Helper to toggle month selection in Amendment drawer
    const toggleAmendmentMonth = (m: number) => {
        setSelectedMonthsForAmendment(prev =>
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b)
        );
    };

    // Helpers to open drawers with clean blank form
    const handleOpenCreateContractModal = () => {
        resetContractFormToBlank();
        setIsCreateContractOpen(true);
    };

    const handleOpenCreateAmendmentModal = (contractId: string, reasonPreset?: string) => {
        setSelectedContractIdForAmendment(contractId);
        const timestampSuffix = String(Date.now()).slice(-2);
        setAmendmentNumber(`AMD-${selectedYear}-${timestampSuffix}`);
        setAmendmentReason(reasonPreset || 'Volume Quota Extension Addendum (Over-Achievement Cap Increase)');
        setRevisedUnitRate('11500');
        setRevisedTargetVolume('10000');
        setRevisedPoleRate('');
        setRevisedPerMeterRate('');
        setAmendmentDocumentUrl('');
        setSelectedMonthsForAmendment([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        setIsCreateAmendmentOpen(true);
    };

    // Query 12-Month Annual Performance Matrix
    const { data: annualPerformanceList, isLoading: isPerfLoading } = useQuery<AnnualPerformance[]>({
        queryKey: ['slt-annual-performance', selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/contracts/slt/performance?year=${selectedYear}&_t=${Date.now()}`);
            const json = await res.json();
            return json.data || [];
        },
        staleTime: 0,
        refetchOnMount: true
    });

    // Helper: Bulk set rate to all 12 months
    const applyRateToAllMonths = (rate: string) => {
        setMonthlyTargets(prev => prev.map(m => ({ ...m, rate })));
        toast.info(`Applied LKR ${rate} base rate to all 12 months`);
    };

    // Create 12-Month Contract Mutation
    const createContractMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                contractNumber,
                title: contractTitle,
                startDate,
                endDate,
                documentUrl: contractDocumentUrl || undefined,
                ceilingValue: ceilingValue ? Number(ceilingValue) : undefined,
                poleRate56: globalPole56Rate ? Number(globalPole56Rate) : undefined,
                poleRate67: globalPoleRate ? Number(globalPoleRate) : undefined,
                poleRate80: globalPole80Rate ? Number(globalPole80Rate) : undefined,
                poleAdminFee: globalPoleAdminFee ? Number(globalPoleAdminFee) : undefined,
                targets: monthlyTargets.map(t => ({
                    year: selectedYear,
                    month: t.month,
                    targetVolume: Number(t.volume || 0),
                    baseUnitRate: Number(t.rate || 10000),
                    poleRate: globalPoleRate ? Number(globalPoleRate) : 4500,
                    perMeterRate: globalPerMeterRate ? Number(globalPerMeterRate) : 250,
                    distanceThresholdMeters: globalDistanceThreshold ? Number(globalDistanceThreshold) : 50
                }))
            };
            const res = await fetch('/api/contracts/slt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                const errMsg = typeof json.error === 'string'
                    ? json.error
                    : (json.error?.message || json.message || 'Failed to create contract');
                throw new Error(errMsg);
            }
            return json.data;
        },
        onSuccess: () => {
            toast.success('12-Month Annual Master Agreement Created Successfully!');
            setIsCreateContractOpen(false);
            queryClient.invalidateQueries({ queryKey: ['slt-annual-performance'] });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to create contract';
            toast.error(msg);
        }
    });

    // Delete Contract Mutation
    const deleteContractMutation = useMutation({
        mutationFn: async (contractId: string) => {
            const res = await fetch(`/api/contracts/slt/${contractId}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (!res.ok) {
                const errMsg = typeof json.error === 'string'
                    ? json.error
                    : (json.error?.message || json.message || 'Failed to delete contract');
                throw new Error(errMsg);
            }
            return json.data;
        },
        onSuccess: () => {
            toast.success('Agreement Removed Successfully!');
            setContractToDelete(null);
            queryClient.invalidateQueries({ queryKey: ['slt-annual-performance'] });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to delete contract';
            toast.error(msg);
        }
    });

    // Create Amendment Mutation
    const createAmendmentMutation = useMutation({
        mutationFn: async () => {
            if (selectedMonthsForAmendment.length === 0) {
                throw new Error('Please select at least one month for this amendment');
            }

            const payload = {
                contractId: selectedContractIdForAmendment,
                amendmentNumber,
                effectiveDate: new Date().toISOString().split('T')[0],
                reason: amendmentReason,
                targetMonths: selectedMonthsForAmendment,
                revisedUnitRate: revisedUnitRate ? Number(revisedUnitRate) : undefined,
                revisedTargetVolume: revisedTargetVolume ? Number(revisedTargetVolume) : undefined,
                revisedPoleRate: revisedPoleRate ? Number(revisedPoleRate) : undefined,
                revisedPerMeterRate: revisedPerMeterRate ? Number(revisedPerMeterRate) : undefined,
                ceilingValue: amendmentCeilingValue ? Number(amendmentCeilingValue) : undefined,
                ceilingIncrease: amendmentCeilingIncrease ? Number(amendmentCeilingIncrease) : undefined,
                documentUrl: amendmentDocumentUrl || undefined
            };
            const res = await fetch('/api/contracts/slt/amendments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!res.ok) {
                const errMsg = typeof json.error === 'string'
                    ? json.error
                    : (json.error?.message || json.message || 'Failed to file amendment');
                throw new Error(errMsg);
            }
            return json.data;
        },
        onSuccess: () => {
            toast.success('Contract Rate Amendment / Quota Addendum Filed Successfully!');
            setIsCreateAmendmentOpen(false);
            queryClient.invalidateQueries({ queryKey: ['slt-annual-performance'] });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to file amendment';
            toast.error(msg);
        }
    });

    return (
        <div className="h-screen flex bg-background text-foreground overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <Header />
                <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border shadow-sm">
                        <div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold uppercase">
                                    SLT Commercial Contracts & Rate Agreements
                                </Badge>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1 flex items-center gap-3">
                                <FileCheck2 className="w-8 h-8 text-primary" />
                                SLT Master Commercial Agreements & Rate Schedules
                            </h1>
                            <p className="text-xs md:text-sm text-muted-foreground mt-1">
                                Full-year commitment schedules, custom date ranges, connection rates, pole surcharges, and signed contract documents.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                onClick={handleOpenCreateContractModal}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-md text-xs h-10 px-4"
                            >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Create Master Commercial Agreement
                            </Button>
                        </div>
                    </div>

                    {/* Year Selector & Custom Date Range Notice */}
                    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">Annual Matrix Year:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="h-8 px-3 text-xs font-bold rounded-xl border border-border bg-background text-foreground cursor-pointer"
                            >
                                <option value={2026}>Year 2026</option>
                                <option value={2025}>Year 2025</option>
                            </select>
                        </div>

                        <span className="text-xs text-muted-foreground font-semibold">
                            Displaying Active Agreements & Addendums for <span className="text-foreground font-bold">Year {selectedYear}</span>
                        </span>
                    </div>

                    {/* 12-Month Annual Financial & Operational Matrix Table */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-500" />
                            Master Commercial Agreements & Volume Quota Tracker ({selectedYear})
                        </h2>

                        {isPerfLoading ? (
                            <div className="p-12 text-center bg-card border border-border rounded-3xl shadow-sm">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                <p className="text-xs text-muted-foreground font-semibold mt-2">Calculating agreement matrix performance...</p>
                            </div>
                        ) : !annualPerformanceList || annualPerformanceList.length === 0 ? (
                            <div className="bg-card p-8 rounded-3xl text-center space-y-3 border border-dashed border-border shadow-sm">
                                <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
                                <h3 className="font-extrabold text-foreground text-sm">No Commercial Agreement Found for {selectedYear}</h3>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    No agreement matrix configured for this period. Click below to create an annual or custom date range master agreement.
                                </p>
                                <Button
                                    onClick={handleOpenCreateContractModal}
                                    size="sm"
                                    className="rounded-xl font-bold"
                                >
                                    Create Master Commercial Agreement
                                </Button>
                            </div>
                        ) : (
                            annualPerformanceList.map((ann, idx) => (
                                <Card key={idx} className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                                    <CardHeader className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className="bg-primary/10 text-primary border-primary/20 font-mono font-bold text-xs">
                                                    {ann.contractNumber}
                                                </Badge>
                                                {ann.startDate && ann.endDate && (
                                                    <Badge variant="outline" className="bg-muted text-foreground text-xs font-mono font-semibold">
                                                        Validity: {ann.startDate} to {ann.endDate}
                                                    </Badge>
                                                )}
                                                {ann.quotaStatus === 'QUOTA_EXCEEDED' && (
                                                    <Badge className="bg-rose-500 text-white font-bold text-xs animate-pulse flex items-center gap-1">
                                                        <ShieldAlert className="w-3.5 h-3.5" />
                                                        Quota Cap Exceeded ({ann.annualTotals.overallAchievementPercent}%)
                                                    </Badge>
                                                )}
                                                {ann.quotaStatus === 'NEARING_CAP' && (
                                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold text-xs flex items-center gap-1">
                                                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                                                        90%+ Quota Consumed ({ann.annualTotals.overallAchievementPercent}%)
                                                    </Badge>
                                                )}
                                                {ann.documentUrl && (
                                                    <a
                                                        href={ann.documentUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-bold hover:bg-rose-500/20 transition-all"
                                                    >
                                                        <FileDown className="w-3.5 h-3.5" />
                                                        Agreement PDF
                                                        <ExternalLink className="w-3 h-3 ml-0.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg font-extrabold text-foreground">{ann.title}</CardTitle>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Button
                                                onClick={() => handleOpenCreateAmendmentModal(
                                                    ann.contractId,
                                                    ann.quotaStatus === 'QUOTA_EXCEEDED'
                                                        ? 'Volume Quota Extension Addendum (Over-Achievement Cap Increase)'
                                                        : 'Crisis Fuel Surcharge Rate Revision'
                                                )}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-9 px-3"
                                            >
                                                <PlusCircle className="w-4 h-4 mr-1.5" />
                                                {ann.quotaStatus === 'QUOTA_EXCEEDED' ? 'File Quota Extension Addendum' : 'File Rate Amendment'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setContractToDelete({ id: ann.contractId, number: ann.contractNumber, title: ann.title })}
                                                disabled={deleteContractMutation.isPending}
                                                className="text-rose-500 hover:text-rose-600 border-rose-500/30 hover:bg-rose-500/10 rounded-xl text-xs font-bold h-9 px-3"
                                            >
                                                <Trash2 className="w-4 h-4 mr-1.5" />
                                                Remove Agreement
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
                                                    <tr className="text-left">
                                                        <th className="px-5 py-3.5">Month</th>
                                                        <th className="px-4 py-3.5 text-indigo-500">Target SODs</th>
                                                        <th className="px-4 py-3.5 text-emerald-500">Actual SODs</th>
                                                        <th className="px-4 py-3.5">Achieved %</th>
                                                        <th className="px-4 py-3.5">Base Rate</th>
                                                        <th className="px-4 py-3.5 text-emerald-600 dark:text-emerald-400">Effective Rate</th>
                                                        <th className="px-4 py-3.5">Active Amendment</th>
                                                        <th className="px-4 py-3.5">Expected Rev</th>
                                                        <th className="px-4 py-3.5 text-emerald-500 font-extrabold">Realized Rev</th>
                                                        <th className="px-5 py-3.5 text-right">Variance (LKR)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border font-medium">
                                                    {ann.monthlyBreakdown.map((m, i) => (
                                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                                            <td className="px-5 py-3.5 font-bold text-foreground">{m.monthName}</td>
                                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-500">{m.targetVolume.toLocaleString()}</td>
                                                            <td className="px-4 py-3.5 font-mono font-bold text-emerald-500">{m.actualCompleted.toLocaleString()}</td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-bold text-foreground">{m.targetAchievementPercent}%</span>
                                                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${m.targetAchievementPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                                            style={{ width: `${Math.min(m.targetAchievementPercent, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono text-muted-foreground">Rs. {m.baseUnitRate.toLocaleString()}</td>
                                                            <td className="px-4 py-3.5 font-mono font-bold text-emerald-500">Rs. {m.effectiveUnitRate.toLocaleString()}</td>
                                                            <td className="px-4 py-3.5">
                                                                {m.activeAmendment ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-mono text-[10px]">
                                                                            {m.activeAmendment.amendmentNumber}
                                                                        </Badge>
                                                                        {m.activeAmendment.documentUrl && (
                                                                            <a
                                                                                href={m.activeAmendment.documentUrl}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="text-rose-500 hover:text-rose-600 font-bold flex items-center gap-0.5 text-[10px]"
                                                                                title="View Amendment PDF"
                                                                            >
                                                                                <FileDown className="w-3 h-3" />
                                                                                PDF
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[11px] text-muted-foreground">Base Agreement</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono text-muted-foreground">Rs. {m.contractedRevenue.toLocaleString()}</td>
                                                            <td className="px-4 py-3.5 font-mono font-extrabold text-emerald-500">Rs. {m.actualRevenue.toLocaleString()}</td>
                                                            <td className={`px-5 py-3.5 text-right font-mono font-bold ${m.revenueVariance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {m.revenueVariance >= 0 ? '+' : ''}Rs. {m.revenueVariance.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {/* Annual Totals Summary Footer */}
                                                <tfoot className="bg-muted/50 border-t-2 border-border font-mono font-extrabold">
                                                    <tr>
                                                        <td className="px-5 py-4 text-foreground uppercase tracking-wider">ANNUAL TOTALS ({ann.year}):</td>
                                                        <td className="px-4 py-4 text-indigo-500">{ann.annualTotals.totalTargetVolume.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-emerald-500">{ann.annualTotals.totalActualCompleted.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-foreground">{ann.annualTotals.overallAchievementPercent}%</td>
                                                        <td colSpan={3} className="px-4 py-4 text-muted-foreground text-[11px] uppercase font-sans">Full Year Commitment</td>
                                                        <td className="px-4 py-4 text-muted-foreground">Rs. {ann.annualTotals.totalContractedRevenue.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-emerald-500">Rs. {ann.annualTotals.totalActualRevenue.toLocaleString()}</td>
                                                        <td className={`px-5 py-4 text-right ${ann.annualTotals.totalRevenueVariance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {ann.annualTotals.totalRevenueVariance >= 0 ? '+' : ''}Rs. {ann.annualTotals.totalRevenueVariance.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* DELETE AGREEMENT CONFIRMATION MODAL */}
                    <Dialog open={!!contractToDelete} onOpenChange={(open) => !open && setContractToDelete(null)}>
                        <DialogContent className="max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4">
                            <DialogHeader className="text-center space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <DialogTitle className="text-lg font-extrabold text-foreground">
                                    Remove Commercial Agreement?
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                    Are you sure you want to permanently remove <span className="font-bold text-foreground font-mono">{contractToDelete?.number}</span> ({contractToDelete?.title})? This will delete all 12-month commitment schedules and rate amendments for this agreement.
                                </DialogDescription>
                            </DialogHeader>

                            <DialogFooter className="flex flex-row items-center justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setContractToDelete(null)}
                                    className="rounded-xl text-xs font-bold h-9 px-4"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => contractToDelete && deleteContractMutation.mutate(contractToDelete.id)}
                                    disabled={deleteContractMutation.isPending}
                                    className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-9 px-5 shadow-md"
                                >
                                    {deleteContractMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            Removing...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                            Confirm Remove
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* 12-Month Matrix Contract Creation SOLID SLIDE DRAWER */}
                    <Sheet open={isCreateContractOpen} onOpenChange={setIsCreateContractOpen}>
                        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 bg-background border-l border-border flex flex-col h-full shadow-2xl">
                            <SheetHeader className="p-6 border-b border-border bg-card shrink-0">
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold uppercase">
                                        Master Agreement Configuration
                                    </Badge>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={resetContractFormToBlank}
                                            className="h-7 px-2.5 text-[11px] font-bold rounded-lg hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                                        >
                                            <Trash2 className="w-3 h-3 mr-1 text-rose-500" />
                                            Clear Form
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={apply2026ContractTemplate}
                                            className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                        >
                                            <Zap className="w-3 h-3 mr-1 text-amber-500" />
                                            2026 Preset
                                        </Button>
                                    </div>
                                </div>
                                <SheetTitle className="text-xl font-extrabold flex items-center gap-2.5 text-foreground mt-1">
                                    <FileCheck2 className="w-6 h-6 text-primary" />
                                    Create Master Commercial Agreement
                                </SheetTitle>
                                <SheetDescription className="text-xs text-muted-foreground">
                                    Upload signed agreement PDF to auto-fill via AI, or configure custom dates, connection targets, and rates.
                                </SheetDescription>
                            </SheetHeader>

                            {/* Scrollable Drawer Body */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 text-xs bg-background">
                                {/* Agreement Info & Custom Validity Dates */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Agreement Number</label>
                                        <Input
                                            value={contractNumber}
                                            onChange={(e) => setContractNumber(e.target.value)}
                                            placeholder="AGR-2026-0101"
                                            className="h-9 text-xs font-mono font-bold rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Agreement Title</label>
                                        <Input
                                            value={contractTitle}
                                            onChange={(e) => setContractTitle(e.target.value)}
                                            placeholder="SLT OSP Fiber Connection Annual Agreement 2026"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Validity Start Date</label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-9 text-xs font-mono font-bold rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Validity End Date</label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="h-9 text-xs font-mono font-bold rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* SLT Connection Surcharge & Multiplier Rules */}
                                <div className="p-4 bg-card border border-border rounded-2xl space-y-4 shadow-sm">
                                    <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Sliders className="w-4 h-4 text-amber-500" />
                                        Concrete Pole Approved Rates & Distance Rules (Annex A)
                                    </span>
                                    
                                    {/* Pole Rates by Category */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-foreground">Concrete Pole Rates (LKR / Pole)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-semibold">5.6m Pole Rate</label>
                                                <Input
                                                    type="number"
                                                    value={globalPole56Rate}
                                                    onChange={(e) => setGlobalPole56Rate(e.target.value)}
                                                    placeholder="7547.78"
                                                    className="h-8 text-xs font-mono font-bold rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-semibold">6.7m Pole Rate (Std)</label>
                                                <Input
                                                    type="number"
                                                    value={globalPoleRate}
                                                    onChange={(e) => setGlobalPoleRate(e.target.value)}
                                                    placeholder="10396.84"
                                                    className="h-8 text-xs font-mono font-bold rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-semibold">8.0m Pole Rate</label>
                                                <Input
                                                    type="number"
                                                    value={globalPole80Rate}
                                                    onChange={(e) => setGlobalPole80Rate(e.target.value)}
                                                    placeholder="17369.34"
                                                    className="h-8 text-xs font-mono font-bold rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-semibold">Pole Admin Fee (1B)</label>
                                                <Input
                                                    type="number"
                                                    value={globalPoleAdminFee}
                                                    onChange={(e) => setGlobalPoleAdminFee(e.target.value)}
                                                    placeholder="500"
                                                    className="h-8 text-xs font-mono font-bold rounded-xl text-emerald-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Distance & Drop Wire Cap Rules */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Distance Rate (LKR / Meter)</label>
                                            <Input
                                                type="number"
                                                value={globalPerMeterRate}
                                                onChange={(e) => setGlobalPerMeterRate(e.target.value)}
                                                placeholder="0 (FOC >180m)"
                                                className="h-8 text-xs font-mono font-bold rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Max Drop Wire Cap (Clause 17.7)</label>
                                            <Input
                                                type="number"
                                                value={globalDistanceThreshold}
                                                onChange={(e) => setGlobalDistanceThreshold(e.target.value)}
                                                placeholder="180"
                                                className="h-8 text-xs font-mono font-bold rounded-xl text-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Maximum Financial Ceiling Value */}
                                    <div className="space-y-1 pt-1 border-t border-border/50">
                                        <label className="text-[10px] text-muted-foreground font-semibold">Maximum Ceiling Value (LKR) — Contract Budget Cap</label>
                                        <Input
                                            type="number"
                                            value={ceilingValue}
                                            onChange={(e) => setCeilingValue(e.target.value)}
                                            placeholder="e.g. 2124700000"
                                            className="h-8 text-xs font-mono font-bold rounded-xl text-emerald-600"
                                        />
                                    </div>
                                </div>

                                {/* PDF Document Upload & AI Parser Box */}
                                <div className="p-4 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <label className="font-extrabold text-foreground flex items-center gap-2">
                                            <Upload className="w-4 h-4 text-primary" />
                                            Signed Master Commercial Agreement PDF Document:
                                        </label>
                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] font-bold">
                                            🤖 AI Contract PDF Parser Active
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleFileUpload(f, 'contract');
                                            }}
                                            className="h-9 text-xs rounded-xl cursor-pointer bg-background flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isAiParsing}
                                            onClick={async () => {
                                                setIsAiParsing(true);
                                                toast.loading('📄 Reading contract PDF text...', { id: aiToastId, duration: 20000 });
                                                try {
                                                    const payload = contractDocumentUrl ? { documentUrl: contractDocumentUrl } : {};
                                                    const res = await fetch('/api/contracts/slt/ai-parse', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(payload)
                                                    });
                                                    const json = await res.json() as { extracted?: Record<string, unknown> | null; isScanned?: boolean; source?: string };
                                                    toast.dismiss(aiToastId);
                                                    const ext = (json?.extracted || {}) as Record<string, unknown>;
                                                    const warnings = Array.isArray(ext.warnings) ? ext.warnings as string[] : [];
                                                    if (json?.isScanned || ext.isScanned) {
                                                        toast.warning('⚠️ Scanned/image-only PDF detected — no readable text. Please fill fields manually.');
                                                    } else if (json?.extracted) {
                                                        if (ext.contractNumber) setContractNumber(String(ext.contractNumber));
                                                        if (ext.title) setContractTitle(String(ext.title));
                                                        if (ext.startDate) setStartDate(String(ext.startDate));
                                                        if (ext.endDate) setEndDate(String(ext.endDate));
                                                        if (ext.baseUnitRate) setGlobalBaseRate(String(ext.baseUnitRate));
                                                        if (ext.poleRate56) setGlobalPole56Rate(String(ext.poleRate56));
                                                        if (ext.poleRate67) setGlobalPoleRate(String(ext.poleRate67));
                                                        if (ext.poleRate80) setGlobalPole80Rate(String(ext.poleRate80));
                                                        if (ext.poleAdminFee) setGlobalPoleAdminFee(String(ext.poleAdminFee));
                                                        if (ext.distanceThresholdMeters) setGlobalDistanceThreshold(String(ext.distanceThresholdMeters));
                                                        if (Array.isArray(ext.monthlyTargets) && ext.monthlyTargets.length > 0) {
                                                            setMonthlyTargets(ext.monthlyTargets as Array<{ month: number; volume: string; rate: string }>);
                                                        }
                                                        if (Array.isArray(ext.detectedVariations)) {
                                                            setDetectedVariations(ext.detectedVariations as string[]);
                                                        }
                                                        toast.success('✨ Pattern Engine auto-filled all contract parameters!');
                                                    }
                                                    warnings.forEach(w => toast.warning(w));
                                                } catch (err) {
                                                    toast.dismiss(aiToastId);
                                                    console.warn('[AI_FILL_ERR]', err);
                                                    toast.error('PDF Parsing failed');
                                                } finally {
                                                    setIsAiParsing(false);
                                                }
                                            }}
                                            className="rounded-xl text-xs font-extrabold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 h-9 px-3 gap-1.5 shrink-0"
                                        >
                                            {isAiParsing ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    Parsing...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                                    ✨ AI Auto-Fill
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    {isAiParsing && (
                                        <span className="flex items-center gap-1.5 text-xs text-primary font-bold animate-pulse">
                                            <Loader2 className="w-4 h-4 animate-spin" /> 📄 Reading & extracting contract data from PDF...
                                        </span>
                                    )}
                                    {contractDocumentUrl && !isAiParsing && (
                                        <div className="flex items-center gap-2 pt-1 text-emerald-500 font-bold text-xs">
                                            <FileCheck2 className="w-4 h-4" />
                                            Attached & AI Parsed: <a href={contractDocumentUrl} target="_blank" rel="noreferrer" className="underline font-mono text-[11px]">{contractDocumentUrl}</a>
                                        </div>
                                    )}
                                    {detectedVariations.length > 0 && (
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 mt-2">
                                            <span className="font-extrabold text-amber-500 text-xs flex items-center gap-1.5">
                                                <AlertCircle className="w-4 h-4" />
                                                Detected Contract Variations & Clause Differences ({detectedVariations.length}):
                                            </span>
                                            <ul className="space-y-1 pl-4 list-disc text-[11px] text-foreground font-medium">
                                                {detectedVariations.map((v, i) => (
                                                    <li key={i}>{v}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Action Bulk Rate Tool */}
                                <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                                    <span className="font-extrabold text-foreground flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        Quick Helper: Apply Connection Base Rate to All 12 Months:
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={globalBaseRate}
                                            onChange={(e) => setGlobalBaseRate(e.target.value)}
                                            placeholder="10000"
                                            className="h-8 w-28 text-xs font-mono font-bold rounded-xl"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => applyRateToAllMonths(globalBaseRate)}
                                            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground h-8 px-3"
                                        >
                                            Apply All 12 Months
                                        </Button>
                                    </div>
                                </div>

                                {/* 12-Month Target Input Matrix Grid */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-foreground text-sm uppercase tracking-wider">
                                            Monthly Target Quota Schedule (Jan - Dec {selectedYear})
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-semibold">12 Months Target Matrix</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {monthlyTargets.map((t) => (
                                            <div key={t.month} className="p-3.5 bg-card border border-border rounded-2xl space-y-2.5 shadow-sm hover:border-primary/40 transition-all">
                                                <span className="font-extrabold text-foreground text-xs flex items-center justify-between">
                                                    <span>{MONTH_NAMES[t.month - 1]}</span>
                                                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">M{t.month}</Badge>
                                                </span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Target SODs</label>
                                                        <Input
                                                            type="number"
                                                            value={t.volume}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setMonthlyTargets(prev => prev.map(m => m.month === t.month ? { ...m, volume: val } : m));
                                                            }}
                                                            className="h-8 text-xs font-mono font-bold rounded-xl"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Base Rate (LKR)</label>
                                                        <Input
                                                            type="number"
                                                            value={t.rate}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setMonthlyTargets(prev => prev.map(m => m.month === t.month ? { ...m, rate: val } : m));
                                                            }}
                                                            className="h-8 text-xs font-mono font-bold rounded-xl text-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Drawer Footer */}
                            <SheetFooter className="p-5 border-t border-border bg-card shrink-0 flex flex-row items-center justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCreateContractOpen(false)}
                                    className="rounded-xl text-xs font-bold h-10 px-5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => createContractMutation.mutate()}
                                    disabled={createContractMutation.isPending}
                                    className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 shadow-md"
                                >
                                    {createContractMutation.isPending ? 'Saving Master Agreement...' : 'Save Master Agreement'}
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>

                    {/* File Amendment SOLID SLIDE DRAWER */}
                    <Sheet open={isCreateAmendmentOpen} onOpenChange={setIsCreateAmendmentOpen}>
                        <SheetContent side="right" className="w-full sm:max-w-xl p-0 bg-background border-l border-border flex flex-col h-full shadow-2xl">
                            <SheetHeader className="p-6 border-b border-border bg-card shrink-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-xs font-bold uppercase">
                                        Rate & Volume Addendum
                                    </Badge>
                                </div>
                                <SheetTitle className="text-xl font-extrabold flex items-center gap-2.5 text-foreground mt-1">
                                    <FileText className="w-6 h-6 text-indigo-500" />
                                    File Rate Amendment or Volume Quota Addendum
                                </SheetTitle>
                                <SheetDescription className="text-xs text-muted-foreground">
                                    Apply rate revisions, quota cap extensions, pole surcharges, and attach signed addendum PDF.
                                </SheetDescription>
                            </SheetHeader>

                            {/* Scrollable Drawer Body */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 text-xs bg-background">
                                <div className="space-y-1">
                                    <label className="font-bold text-foreground">Amendment / Addendum Number</label>
                                    <Input
                                        value={amendmentNumber}
                                        onChange={(e) => setAmendmentNumber(e.target.value)}
                                        placeholder="AMD-2026-01"
                                        className="h-9 text-xs font-mono font-bold rounded-xl"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-foreground">Reason / Description of Revision</label>
                                    <Input
                                        value={amendmentReason}
                                        onChange={(e) => setAmendmentReason(e.target.value)}
                                        placeholder="Volume Quota Extension Addendum / Crisis Fuel Surcharge"
                                        className="h-9 text-xs rounded-xl"
                                    />
                                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                        <span className="text-[10px] text-muted-foreground">Quick Presets:</span>
                                        <button
                                            type="button"
                                            onClick={() => setAmendmentReason('Volume Quota Extension Addendum (Over-Achievement Cap Increase)')}
                                            className="text-[10px] font-bold text-indigo-500 hover:underline"
                                        >
                                            + Quota Extension
                                        </button>
                                        <span className="text-muted-foreground text-[10px]">•</span>
                                        <button
                                            type="button"
                                            onClick={() => setAmendmentReason('Crisis Fuel Surcharge Rate Revision')}
                                            className="text-[10px] font-bold text-indigo-500 hover:underline"
                                        >
                                            + Fuel Revision
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Revised Base Unit Rate (LKR)</label>
                                        <Input
                                            type="number"
                                            value={revisedUnitRate}
                                            onChange={(e) => setRevisedUnitRate(e.target.value)}
                                            placeholder="11500"
                                            className="h-9 text-xs font-mono font-bold rounded-xl text-emerald-500"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-bold text-foreground">Revised Target SODs (Volume Extension)</label>
                                        <Input
                                            type="number"
                                            value={revisedTargetVolume}
                                            onChange={(e) => setRevisedTargetVolume(e.target.value)}
                                            placeholder="Leave blank if unchanged"
                                            className="h-9 text-xs font-mono font-bold rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Multi-Tier Surcharges in Amendment */}
                                <div className="p-4 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
                                    <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Sliders className="w-4 h-4 text-indigo-500" />
                                        Revised Pole & Distance Span Multipliers (Optional)
                                    </span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Revised Pole Rate (LKR / Pole)</label>
                                            <Input
                                                type="number"
                                                value={revisedPoleRate}
                                                onChange={(e) => setRevisedPoleRate(e.target.value)}
                                                placeholder="e.g. 5000"
                                                className="h-8 text-xs font-mono font-bold rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Revised Distance Rate (LKR / Meter)</label>
                                            <Input
                                                type="number"
                                                value={revisedPerMeterRate}
                                                onChange={(e) => setRevisedPerMeterRate(e.target.value)}
                                                placeholder="e.g. 300"
                                                className="h-8 text-xs font-mono font-bold rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    {/* Revised Financial Ceiling */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Revised Ceiling Value (LKR)</label>
                                            <Input
                                                type="number"
                                                value={amendmentCeilingValue}
                                                onChange={(e) => setAmendmentCeilingValue(e.target.value)}
                                                placeholder="e.g. 2749708800"
                                                className="h-8 text-xs font-mono font-bold rounded-xl text-emerald-600"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-muted-foreground font-semibold">Ceiling Increase (LKR)</label>
                                            <Input
                                                type="number"
                                                value={amendmentCeilingIncrease}
                                                onChange={(e) => setAmendmentCeilingIncrease(e.target.value)}
                                                placeholder="e.g. 917308800"
                                                className="h-8 text-xs font-mono font-bold rounded-xl text-amber-600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* PDF Amendment Document Upload Box */}
                                <div className="p-4 bg-card border border-border rounded-2xl space-y-2 shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="font-extrabold text-foreground flex items-center gap-2">
                                            <Upload className="w-4 h-4 text-indigo-500" />
                                            Signed Amendment Addendum PDF Document (Optional):
                                        </label>
                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] font-bold">
                                            🤖 Auto-Fill from PDF Active
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleFileUpload(f, 'amendment');
                                            }}
                                            className="h-9 text-xs rounded-xl cursor-pointer bg-background"
                                        />
                                        {isUploadingAmendmentPdf && (
                                            <span className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Uploading PDF...
                                            </span>
                                        )}
                                        {isAiParsing && !isUploadingAmendmentPdf && (
                                            <span className="flex items-center gap-1.5 text-xs text-primary font-bold animate-pulse">
                                                <Loader2 className="w-4 h-4 animate-spin" /> 📄 Reading amendment...
                                            </span>
                                        )}
                                    </div>
                                    {amendmentDocumentUrl && (
                                        <div className="flex items-center gap-2 pt-1 text-emerald-500 font-bold text-xs">
                                            <FileCheck2 className="w-4 h-4" />
                                            Attached: <a href={amendmentDocumentUrl} target="_blank" rel="noreferrer" className="underline font-mono text-[11px]">{amendmentDocumentUrl}</a>
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Target Months Selector Grid */}
                                <div className="space-y-3 p-4 bg-card border border-border rounded-2xl">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-foreground text-xs uppercase tracking-wider">
                                            Target Months Revision Applies To ({selectedMonthsForAmendment.length} Months Selected)
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedMonthsForAmendment([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                                                className="h-6 text-[10px] font-bold px-2 rounded-lg"
                                            >
                                                All 12 Months
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedMonthsForAmendment([])}
                                                className="h-6 text-[10px] font-bold px-2 rounded-lg text-rose-500 hover:text-rose-600"
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {MONTH_NAMES.map((name, i) => {
                                            const monthNum = i + 1;
                                            const isSelected = selectedMonthsForAmendment.includes(monthNum);
                                            return (
                                                <button
                                                    key={monthNum}
                                                    type="button"
                                                    onClick={() => toggleAmendmentMonth(monthNum)}
                                                    className={`p-2 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-background text-muted-foreground border-border hover:border-indigo-500/50'
                                                    }`}
                                                >
                                                    <span className="text-[11px]">{name.slice(0, 3)}</span>
                                                    <span className="text-[9px] opacity-80">M{monthNum}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Drawer Footer */}
                            <SheetFooter className="p-5 border-t border-border bg-card shrink-0 flex flex-row items-center justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCreateAmendmentOpen(false)}
                                    className="rounded-xl text-xs font-bold h-10 px-5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => createAmendmentMutation.mutate()}
                                    disabled={createAmendmentMutation.isPending}
                                    className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 shadow-md"
                                >
                                    {createAmendmentMutation.isPending ? 'Filing Addendum...' : 'File Addendum / Amendment'}
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </div>
            </main>
        </div>
    );
}
