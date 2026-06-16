"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, 
    Calculator, 
    Save, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Send,
    Loader2,
    DollarSign,
    Fuel,
    Gauge,
    Calendar,
    User,
    Building2,
    Ban,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Printer,
    History,
} from 'lucide-react';
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface MonthlySummaryData {
    id: string;
    year: number;
    month: number;
    rental_cost_monthly: number;
    driver_portion_monthly: number | null;
    expected_working_days: number | null;
    rate_per_additional_km: number | null;
    absent_deduction_rate: number | null;
    fuel_allowance_per_km: number | null;
    fuel_supplying: string | null;
    fuel_efficiency: number | null;
    mileage_limit_monthly: number | null;
    excess_mileage_cost_per_km: number | null;
    fuel_included: boolean;
    total_days_worked: number | null;
    absent_days: number | null;
    total_km_traveled: number | null;
    base_rental: number;
    fuel_allowance_amount: number;
    driver_overtime_pay: number;
    absent_deductions: number;
    additional_km_charges: number;
    net_payment: number;
    status: string;
    prepared_by_id: string | null;
    prepared_by_name: string | null;
    prepared_at: string | null;
    checked_by_id: string | null;
    checked_by_name: string | null;
    checked_at: string | null;
    checked_remarks: string | null;
    recommended_by_id: string | null;
    recommended_by_name: string | null;
    recommended_at: string | null;
    recommended_remarks: string | null;
    notes: string | null;
    rentalVehicle?: {
        id: string;
        vehicle: {
            id: string;
            registration_number: string;
            make: string;
            model: string;
        };
    };
}

interface PreviewData {
    year: number;
    month: number;
    rental_cost_monthly: number;
    driver_portion_monthly: number | null;
    expected_working_days: number | null;
    rate_per_additional_km: number | null;
    absent_deduction_rate: number | null;
    fuel_allowance_per_km: number | null;
    fuel_supplying: string | null;
    fuel_efficiency: number | null;
    mileage_limit_monthly: number | null;
    excess_mileage_cost_per_km: number | null;
    fuel_included: boolean;
    total_days_worked: number;
    absent_days: number;
    total_km_traveled: number;
    base_rental: number;
    fuel_allowance_amount: number;
    driver_overtime_pay: number;
    absent_deductions: number;
    additional_km_charges: number;
    net_payment: number;
    vehicle_logs_count: number;
    driver_ot_count: number;
    rentalVehicle: {
        id: string;
        supplier_id: string;
        rental_contract_id: string;
        vehicle: {
            id: string;
            registration_number: string;
            make: string;
            model: string;
            year: number;
            site?: { id: string; name: string } | null;
        };
    };
}

interface RentalVehicleInfo {
    id: string;
    vehicle_id: string;
    supplier_id: string;
    supplier_contact: string | null;
    rental_contract_id: string;
    rental_start_date: string;
    rental_end_date: string;
    rental_cost_monthly: number | null;
    rental_cost_daily: number;
    fuel_included: boolean;
    driver_portion_monthly: number | null;
    expected_working_days: number | null;
    absent_deduction_rate: number | null;
    fuel_allowance_per_km: number | null;
    fuel_supplying: string | null;
    mileage_limit_monthly: number | null;
    fuel_efficiency: number | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_branch: string | null;
    bank_branch_code: string | null;
    vehicle: {
        id: string;
        registration_number: string;
        make: string;
        model: string;
        year: number;
        site?: { id: string; name: string } | null;
    };
}

// ============================================================================
// Workflow Status Config
// ============================================================================

const WORKFLOW_STEPS = [
    { key: 'DRAFT', label: 'Draft', icon: FileText, color: 'text-gray-500', bgColor: 'bg-gray-100' },
    { key: 'SUBMITTED', label: 'Submitted', icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { key: 'CHECKED', label: 'Checked (TA)', icon: CheckCircle2, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    { key: 'RECOMMENDED', label: 'Recommended', icon: TrendingUp, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
];

const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
    DRAFT: { label: 'Draft', variant: 'secondary' },
    SUBMITTED: { label: 'Submitted', variant: 'default' },
    CHECKED: { label: 'Checked', variant: 'outline' },
    RECOMMENDED: { label: 'Recommended', variant: 'secondary' },
    APPROVED: { label: 'Approved', variant: 'default' },
    REJECTED: { label: 'Rejected', variant: 'destructive' },
};

// ============================================================================
// Month Options
// ============================================================================

const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

// ============================================================================
// Helper
// ============================================================================

function currency(value: number): string {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(value);
}

function getCurrentYearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
}

// ============================================================================
// Main Component
// ============================================================================

export default function RentalSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const vehicleId = params.id as string;

    // State
    const [rentalVehicle, setRentalVehicle] = useState<RentalVehicleInfo | null>(null);
    const [loadingVehicle, setLoadingVehicle] = useState(true);

    // Period selection
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

    // Preview / Summary data
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [currentSummary, setCurrentSummary] = useState<MonthlySummaryData | null>(null);
    const [summariesList, setSummariesList] = useState<MonthlySummaryData[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'calculator' | 'history'>('calculator');

    // Modal for workflow actions
    const [actionModal, setActionModal] = useState<{
        open: boolean;
        action: string;
        summaryId: string;
    }>({ open: false, action: '', summaryId: '' });
    const [remarks, setRemarks] = useState('');

    // ========================================================================
    // Data Fetching
    // ========================================================================

    const fetchRentalVehicle = useCallback(async () => {
        try {
            setLoadingVehicle(true);
            const res = await fetch(`/api/vehicles/${vehicleId}`);
            if (!res.ok) throw new Error('Vehicle not found');
            const json = await res.json();
            
            // We need rental vehicle data - fetch it through the rentals API
            // For now, get rental info from the vehicle
            const vehicleData = json.data;
            
            // Fetch rental vehicle info via our new API
            const rentalRes = await fetch(`/api/vehicles/${vehicleId}/rental-summary`);
            if (rentalRes.ok) {
                const rentalJson = await rentalRes.json();
                // The rental info is in the response
                if (rentalJson.data && rentalJson.data.length > 0) {
                    // We already have summaries, set them
                    setSummariesList(rentalJson.data);
                }
                if (rentalJson.meta?.rentalVehicleId) {
                    // Need to fetch rental vehicle details separately
                    fetchRentalVehicleDetails(vehicleId);
                } else {
                    // No rental vehicle found
                    setLoadingVehicle(false);
                }
            } else {
                setLoadingVehicle(false);
            }
        } catch (err: any) {
            setError(err.message);
            setLoadingVehicle(false);
        }
    }, [vehicleId]);

    const fetchRentalVehicleDetails = async (vid: string) => {
        try {
            // Fetch vehicle info via API
            const res = await fetch(`/api/vehicles/${vid}`);
            const json = await res.json();
            if (json.data) {
                // Check ownership type to confirm it's rental
                if (json.data.ownership === 'RENTAL') {
                    // Set some basic info from the vehicle
                    setRentalVehicle({
                        id: vid,
                        vehicle_id: vid,
                        supplier_id: json.data.registration_number,
                        supplier_contact: null,
                        rental_contract_id: '',
                        rental_start_date: '',
                        rental_end_date: '',
                        rental_cost_monthly: null,
                        rental_cost_daily: 0,
                        fuel_included: false,
                        driver_portion_monthly: null,
                        expected_working_days: null,
                        absent_deduction_rate: null,
                        fuel_allowance_per_km: null,
                        fuel_supplying: null,
                        mileage_limit_monthly: null,
                        fuel_efficiency: null,
                        bank_name: null,
                        bank_account_number: null,
                        bank_branch: null,
                        bank_branch_code: null,
                        vehicle: {
                            id: json.data.id,
                            registration_number: json.data.registration_number,
                            make: json.data.make,
                            model: json.data.model,
                            year: json.data.year,
                            site: json.data.site,
                        },
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch rental details:', err);
        } finally {
            setLoadingVehicle(false);
        }
    };

    useEffect(() => {
        if (vehicleId) {
            fetchRentalVehicle();
        }
    }, [vehicleId, fetchRentalVehicle]);

    // ========================================================================
    // Preview Calculation
    // ========================================================================

    const handlePreview = async () => {
        setError(null);
        setSuccessMessage(null);
        setLoadingPreview(true);
        setCurrentSummary(null);

        try {
            const res = await fetch(
                `/api/vehicles/${vehicleId}/rental-summary?mode=preview&year=${selectedYear}&month=${selectedMonth}`
            );

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || 'Failed to calculate preview');
            }

            const json = await res.json();
            setPreview(json.data);

            // Also check if a saved summary exists for this period
            const existingRes = await fetch(
                `/api/vehicles/${vehicleId}/rental-summary?year=${selectedYear}&month=${selectedMonth}`
            );
            if (existingRes.ok) {
                const existingJson = await existingRes.json();
                if (existingJson.data?.id) {
                    setCurrentSummary(existingJson.data);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingPreview(false);
        }
    };

    // ========================================================================
    // Actions
    // ========================================================================

    const handleCreate = async () => {
        setError(null);
        setSuccessMessage(null);
        setLoadingAction(true);

        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/rental-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    year: selectedYear,
                    month: selectedMonth,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || 'Failed to create summary');
            }

            const json = await res.json();
            setCurrentSummary(json.data);
            setSuccessMessage('Summary saved successfully!');
            
            // Refresh list
            const listRes = await fetch(`/api/vehicles/${vehicleId}/rental-summary`);
            if (listRes.ok) {
                const listJson = await listRes.json();
                setSummariesList(listJson.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleWorkflowAction = async (action: string, summaryId: string) => {
        if (action === 'check' || action === 'recommend' || action === 'approve' || action === 'reject') {
            setActionModal({ open: true, action, summaryId });
            setRemarks('');
            return;
        }

        // submit - no remarks needed
        setError(null);
        setSuccessMessage(null);
        setLoadingAction(true);

        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/rental-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    summaryId,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || `Failed to ${action} summary`);
            }

            const json = await res.json();
            setCurrentSummary(json.data);
            setSuccessMessage(`Summary ${action}ed successfully!`);
            
            // Refresh list
            const listRes = await fetch(`/api/vehicles/${vehicleId}/rental-summary`);
            if (listRes.ok) {
                const listJson = await listRes.json();
                setSummariesList(listJson.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const confirmWorkflowAction = async () => {
        const { action, summaryId } = actionModal;
        setActionModal({ open: false, action: '', summaryId: '' });
        setError(null);
        setSuccessMessage(null);
        setLoadingAction(true);

        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/rental-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    summaryId,
                    userId: 'current-user',
                    userName: 'Current User',
                    remarks,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || `Failed to ${action} summary`);
            }

            const json = await res.json();
            setCurrentSummary(json.data);
            setSuccessMessage(`Summary ${action}ed successfully!`);
            
            const listRes = await fetch(`/api/vehicles/${vehicleId}/rental-summary`);
            if (listRes.ok) {
                const listJson = await listRes.json();
                setSummariesList(listJson.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDelete = async (summaryId: string) => {
        if (!confirm('Are you sure you want to delete this summary?')) return;

        setError(null);
        setSuccessMessage(null);
        setLoadingAction(true);

        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/rental-summary?summaryId=${summaryId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || 'Failed to delete summary');
            }

            setCurrentSummary(null);
            setPreview(null);
            setSuccessMessage('Summary deleted successfully!');
            
            const listRes = await fetch(`/api/vehicles/${vehicleId}/rental-summary`);
            if (listRes.ok) {
                const listJson = await listRes.json();
                setSummariesList(listJson.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // ========================================================================
    // UI Helpers
    // ========================================================================

    const getMonthLabel = (m: number): string => {
        return MONTHS.find(mm => mm.value === m)?.label || '';
    };

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const statusBadge = (status: string) => {
        const cfg = STATUS_BADGE[status] || { label: status, variant: 'secondary' };
        return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
    };

    // ========================================================================
    // Loading
    // ========================================================================

    if (loadingVehicle) {
        return (
            <div className="erp-page-wrapper flex-row overflow-hidden">
                <Sidebar />
                <main className="flex-1 p-6">
                    <Header />
                    <div className="max-w-7xl mx-auto space-y-4 mt-6">
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ========================================================================
    // Render
    // ========================================================================

    const vehicleInfo = rentalVehicle?.vehicle;

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 p-6">
                <Header />
                <div className="max-w-7xl mx-auto space-y-4 mt-6 print:mt-0">
                    {/* Back button & Header */}
                    <div className="flex items-center justify-between print:hidden">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" onClick={() => router.push(`/vehicles/${vehicleId}`)}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold">Monthly Rental Payment Summary</h1>
                                {vehicleInfo && (
                                    <p className="text-muted-foreground">
                                        {vehicleInfo.make} {vehicleInfo.model} - {vehicleInfo.registration_number}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setViewMode(viewMode === 'calculator' ? 'history' : 'calculator')}>
                                {viewMode === 'calculator' ? (
                                    <><History className="w-4 h-4 mr-2" /> History</>
                                ) : (
                                    <><Calculator className="w-4 h-4 mr-2" /> Calculator</>
                                )}
                            </Button>
                            <Button variant="outline" onClick={handlePrint} disabled={!preview && !currentSummary}>
                                <Printer className="w-4 h-4 mr-2" /> Print
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 print:hidden">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>Dismiss</Button>
                        </div>
                    )}
                    {successMessage && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 print:hidden">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{successMessage}</span>
                            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSuccessMessage(null)}>Dismiss</Button>
                        </div>
                    )}

                    {viewMode === 'calculator' ? (
                        <>
                            {/* Period Selector */}
                            <Card className="print:hidden">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calendar className="w-5 h-5" />
                                        Select Period
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end gap-4">
                                        <div className="space-y-1">
                                            <Label>Year</Label>
                                            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
                                                <SelectTrigger className="w-32">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {getCurrentYearOptions().map(y => (
                                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Month</Label>
                                            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(parseInt(v))}>
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder="Month" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {MONTHS.map(m => (
                                                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handlePreview} disabled={loadingPreview}>
                                            {loadingPreview ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
                                            ) : (
                                                <><Calculator className="w-4 h-4 mr-2" /> Calculate Preview</>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Calculation Results */}
                            {(preview || currentSummary) && (
                                <div className="space-y-4">
                                    {/* Workflow Status Bar */}
                                    {(currentSummary?.status && currentSummary.status !== 'DRAFT') ? (
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    {WORKFLOW_STEPS.map((step, idx) => {
                                                        const statusOrder = ['DRAFT', 'SUBMITTED', 'CHECKED', 'RECOMMENDED', 'APPROVED'];
                                                        const currentIdx = statusOrder.indexOf(currentSummary?.status || 'DRAFT');
                                                        const stepIdx = statusOrder.indexOf(step.key);
                                                        const isActive = stepIdx <= currentIdx;
                                                        const isCurrent = step.key === currentSummary?.status;

                                                        if (currentSummary?.status === 'REJECTED') {
                                                            return null;
                                                        }

                                                        return (
                                                            <div key={step.key} className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
                                                                    isCurrent ? 'ring-2 ring-offset-1' : '',
                                                                    isActive ? step.bgColor : 'bg-gray-50 text-gray-400'
                                                                )}>
                                                                    <step.icon className={cn('w-4 h-4', isActive ? step.color : 'text-gray-400')} />
                                                                    <span className={cn('font-medium', isActive ? step.color : 'text-gray-400')}>
                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                                {idx < WORKFLOW_STEPS.length - 1 && currentSummary?.status !== 'REJECTED' && (
                                                                    <div className={cn(
                                                                        'w-8 h-0.5',
                                                                        stepIdx < currentIdx ? 'bg-green-400' : 'bg-gray-200'
                                                                    )} />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {currentSummary?.status === 'REJECTED' && (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-sm">
                                                            <XCircle className="w-4 h-4" />
                                                            <span className="font-medium">Rejected</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ) : currentSummary?.status === 'DRAFT' && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                                            <FileText className="w-4 h-4" />
                                            <span>Draft - ready for submission</span>
                                        </div>
                                    )}

                                    {/* Summary Header Info */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg flex items-center justify-between">
                                                <span>
                                                    Monthly Payment Summary - {getMonthLabel(preview?.month || currentSummary?.month || selectedMonth)} {preview?.year || currentSummary?.year || selectedYear}
                                                </span>
                                                {currentSummary && statusBadge(currentSummary.status)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Vehicle</span>
                                                    <p className="font-medium">{vehicleInfo?.registration_number || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Make / Model</span>
                                                    <p className="font-medium">{vehicleInfo?.make} {vehicleInfo?.model}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Site</span>
                                                    <p className="font-medium">{vehicleInfo?.site?.name || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Supplier ID</span>
                                                    <p className="font-medium">{preview?.rentalVehicle.supplier_id || '-'}</p>
                                                </div>
                                            </div>
                                            {currentSummary && (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t">
                                                    <div>
                                                        <span className="text-muted-foreground">Prepared By</span>
                                                        <p className="font-medium">{currentSummary.prepared_by_name || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Prepared At</span>
                                                        <p className="font-medium">{formatDate(currentSummary.prepared_at)}</p>
                                                    </div>
                                                    {currentSummary.checked_by_name && (
                                                        <div>
                                                            <span className="text-muted-foreground">Checked By</span>
                                                            <p className="font-medium">{currentSummary.checked_by_name}</p>
                                                        </div>
                                                    )}
                                                    {currentSummary.recommended_by_name && (
                                                        <div>
                                                            <span className="text-muted-foreground">Recommended By</span>
                                                            <p className="font-medium">{currentSummary.recommended_by_name}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Excel-Like Calculation Table */}
                                    <Card className="print:shadow-none print:border-0">
                                        <CardHeader className="print:pb-2">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <DollarSign className="w-5 h-5" />
                                                Payment Calculation Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="border rounded-lg overflow-hidden print:border-gray-300">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-muted/50 print:bg-gray-100">
                                                            <th className="text-left px-4 py-3 font-medium">#</th>
                                                            <th className="text-left px-4 py-3 font-medium">Description</th>
                                                            <th className="text-left px-4 py-3 font-medium">Details / Formula</th>
                                                            <th className="text-right px-4 py-3 font-medium">Amount (LKR)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {/* 1. Base Rental */}
                                                        <tr className="border-t">
                                                            <td className="px-4 py-3 text-muted-foreground">1</td>
                                                            <td className="px-4 py-3 font-medium">Base Rental</td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                Vehicle Rate: {currency(preview?.rental_cost_monthly ?? currentSummary?.rental_cost_monthly ?? 0)}
                                                                {preview?.driver_portion_monthly || currentSummary?.driver_portion_monthly ? (
                                                                    <> + Driver Portion: {currency(preview?.driver_portion_monthly ?? currentSummary?.driver_portion_monthly ?? 0)}</>
                                                                ) : null}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">
                                                                {currency(preview?.base_rental ?? currentSummary?.base_rental ?? 0)}
                                                            </td>
                                                        </tr>

                                                        {/* 2. Work Days Info */}
                                                        <tr className="border-t bg-muted/20 print:bg-gray-50">
                                                            <td className="px-4 py-3 text-muted-foreground">2</td>
                                                            <td className="px-4 py-3">Days Worked</td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                Logged Days: {preview?.total_days_worked ?? currentSummary?.total_days_worked ?? 0}
                                                                {preview?.expected_working_days || currentSummary?.expected_working_days ? (
                                                                    <> / Expected: {preview?.expected_working_days ?? currentSummary?.expected_working_days}</>
                                                                ) : null}
                                                                {((preview?.absent_days ?? currentSummary?.absent_days) ?? 0) > 0 && (
                                                                    <> | Absent: {preview?.absent_days ?? currentSummary?.absent_days}</>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">-</td>
                                                        </tr>

                                                        {/* 3. KM Traveled */}
                                                        <tr className="border-t">
                                                            <td className="px-4 py-3 text-muted-foreground">3</td>
                                                            <td className="px-4 py-3">Total KM Traveled</td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {(preview?.total_km_traveled ?? currentSummary?.total_km_traveled ?? 0).toFixed(1)} km
                                                                {(preview?.mileage_limit_monthly || currentSummary?.mileage_limit_monthly) ? (
                                                                    <> | Limit: {preview?.mileage_limit_monthly ?? currentSummary?.mileage_limit_monthly} km</>
                                                                ) : null}
                                                                {((preview?.additional_km_charges ?? currentSummary?.additional_km_charges ?? 0) > 0) && (
                                                                    <> | Over limit charged</>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">-</td>
                                                        </tr>

                                                        {/* 4. Fuel Allowance */}
                                                        <tr className="border-t bg-muted/20 print:bg-gray-50">
                                                            <td className="px-4 py-3 text-muted-foreground">4</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-1">
                                                                    <Fuel className="w-3.5 h-3.5" />
                                                                    Fuel Allowance
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                {preview?.fuel_supplying === 'OWNER' || currentSummary?.fuel_supplying === 'OWNER' ? (
                                                                    <>{(preview?.total_km_traveled ?? currentSummary?.total_km_traveled ?? 0).toFixed(1)} km × {currency(preview?.fuel_allowance_per_km ?? currentSummary?.fuel_allowance_per_km ?? 0)}/km</>
                                                                ) : (
                                                                    <>Fuel supplied by company - no allowance</>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">
                                                                {currency(preview?.fuel_allowance_amount ?? currentSummary?.fuel_allowance_amount ?? 0)}
                                                            </td>
                                                        </tr>

                                                        {/* 5. Driver OT */}
                                                        <tr className="border-t">
                                                            <td className="px-4 py-3 text-muted-foreground">5</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-1">
                                                                    <User className="w-3.5 h-3.5" />
                                                                    Driver Overtime Pay
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-muted-foreground">
                                                                OT records: {preview?.driver_ot_count ?? 0}
                                                                {((preview?.driver_ot_count ?? 0) > 0 || (currentSummary?.driver_overtime_pay ?? 0) > 0) ? (
                                                                    <> | Total OT hours: Calculated from Driver OT records</>
                                                                ) : null}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">
                                                                {currency(preview?.driver_overtime_pay ?? currentSummary?.driver_overtime_pay ?? 0)}
                                                            </td>
                                                        </tr>

                                                        {/* 6. Absent Deductions */}
                                                        {((preview?.absent_deductions ?? currentSummary?.absent_deductions ?? 0) > 0) && (
                                                            <tr className="border-t bg-muted/20 print:bg-gray-50">
                                                                <td className="px-4 py-3 text-muted-foreground">6</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-1 text-red-600">
                                                                        <TrendingDown className="w-3.5 h-3.5" />
                                                                        Absent Deductions
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-muted-foreground">
                                                                    {preview?.absent_days ?? currentSummary?.absent_days} days × {currency(preview?.absent_deduction_rate ?? currentSummary?.absent_deduction_rate ?? 0)}/day
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-semibold text-red-600">
                                                                    -{currency(preview?.absent_deductions ?? currentSummary?.absent_deductions ?? 0)}
                                                                </td>
                                                            </tr>
                                                        )}

                                                        {/* 7. Additional KM Charges */}
                                                        {((preview?.additional_km_charges ?? currentSummary?.additional_km_charges ?? 0) > 0) && (
                                                            <tr className="border-t">
                                                                <td className="px-4 py-3 text-muted-foreground">7</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-1">
                                                                        <Gauge className="w-3.5 h-3.5" />
                                                                        Additional KM Charges
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-muted-foreground">
                                                                    Over limit km charged
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-semibold">
                                                                    +{currency(preview?.additional_km_charges ?? currentSummary?.additional_km_charges ?? 0)}
                                                                </td>
                                                            </tr>
                                                        )}

                                                        {/* NET PAYMENT - GRAND TOTAL */}
                                                        <tr className="border-t-2 border-primary/20 bg-primary/5 print:bg-primary/10">
                                                            <td className="px-4 py-3.5" colSpan={3}>
                                                                <div className="flex items-center gap-2">
                                                                    <DollarSign className="w-5 h-5 text-primary" />
                                                                    <span className="font-bold text-base">Net Payment (For Supplier)</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right font-bold text-lg">
                                                                {currency(preview?.net_payment ?? currentSummary?.net_payment ?? 0)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Data Source Summary */}
                                            <div className="mt-4 text-sm text-muted-foreground grid grid-cols-2 gap-2">
                                                <div>Vehicle Log Entries: {(preview?.vehicle_logs_count ?? 0)}</div>
                                                <div>Driver OT Records: {(preview?.driver_ot_count ?? 0)}</div>
                                                {preview?.fuel_supplying && <div>Fuel Supply: {preview.fuel_supplying}</div>}
                                            </div>

                                            {/* Checks/Remarks */}
                                            {currentSummary?.checked_remarks && (
                                                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                                                    <strong>Checked Remarks:</strong> {currentSummary.checked_remarks}
                                                </div>
                                            )}
                                            {currentSummary?.recommended_remarks && (
                                                <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-800">
                                                    <strong>Recommended Remarks:</strong> {currentSummary.recommended_remarks}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                                        {!currentSummary && (
                                            <Button onClick={handleCreate} disabled={!preview || loadingAction}>
                                                {loadingAction ? (
                                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                                                ) : (
                                                    <><Save className="w-4 h-4 mr-2" /> Save Summary</>
                                                )}
                                            </Button>
                                        )}

                                        {currentSummary?.status === 'DRAFT' && (
                                            <>
                                                <Button onClick={() => handleWorkflowAction('submit', currentSummary.id)} disabled={loadingAction}>
                                                    <Send className="w-4 h-4 mr-2" /> Submit for Checking
                                                </Button>
                                                <Button variant="outline" onClick={() => handleDelete(currentSummary.id)} disabled={loadingAction}>
                                                    Delete
                                                </Button>
                                            </>
                                        )}

                                        {currentSummary?.status === 'SUBMITTED' && (
                                            <Button onClick={() => handleWorkflowAction('check', currentSummary.id)} disabled={loadingAction}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Check (Technical Assistant)
                                            </Button>
                                        )}

                                        {currentSummary?.status === 'CHECKED' && (
                                            <Button onClick={() => handleWorkflowAction('recommend', currentSummary.id)} disabled={loadingAction}>
                                                <TrendingUp className="w-4 h-4 mr-2" /> Recommend (Admin Executive)
                                            </Button>
                                        )}

                                        {currentSummary?.status === 'RECOMMENDED' && (
                                            <Button onClick={() => handleWorkflowAction('approve', currentSummary.id)} disabled={loadingAction}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                            </Button>
                                        )}

                                        {(currentSummary && !['APPROVED', 'REJECTED'].includes(currentSummary.status)) && (
                                            <Button variant="destructive" onClick={() => handleWorkflowAction('reject', currentSummary.id)} disabled={loadingAction}>
                                                <XCircle className="w-4 h-4 mr-2" /> Reject
                                            </Button>
                                        )}

                                        <Button variant="outline" onClick={handlePrint} disabled={!currentSummary}>
                                            <Printer className="w-4 h-4 mr-2" /> Print
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* No data state */}
                            {!preview && !currentSummary && !loadingPreview && (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                        <Calculator className="w-12 h-12 text-muted-foreground/50 mb-3" />
                                        <p className="text-muted-foreground">Select a period and click "Calculate Preview" to generate the monthly rental payment summary.</p>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    ) : (
                        /* ======================================================================== */
                        /* History View */
                        /* ======================================================================== */
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="w-5 h-5" />
                                    Summary History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {summariesList.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No summaries created yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {summariesList.map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 cursor-pointer"
                                                onClick={() => {
                                                    setSelectedYear(s.year);
                                                    setSelectedMonth(s.month);
                                                    setCurrentSummary(s);
                                                    setViewMode('calculator');
                                                }}
                                            >
                                                <div>
                                                    <p className="font-medium">{getMonthLabel(s.month)} {s.year}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Net Payment: {currency(s.net_payment)} | Days Worked: {s.total_days_worked || 0}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {statusBadge(s.status)}
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDate(s.prepared_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            {/* Action Confirmation Modal */}
            {actionModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold mb-2">
                            {actionModal.action === 'check' ? 'Check Summary' :
                             actionModal.action === 'recommend' ? 'Recommend Summary' :
                             actionModal.action === 'approve' ? 'Approve Summary' : 'Reject Summary'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {actionModal.action === 'reject' 
                                ? 'Please provide a reason for rejection.' 
                                : 'Add any remarks or notes (optional).'}
                        </p>
                        <div className="space-y-1 mb-4">
                            <Label>Remarks</Label>
                            <textarea
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder={actionModal.action === 'reject' ? 'Reason for rejection...' : 'Remarks...'}
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setActionModal({ open: false, action: '', summaryId: '' })}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={confirmWorkflowAction}
                                disabled={actionModal.action === 'reject' && !remarks.trim()}
                                variant={actionModal.action === 'reject' ? 'destructive' : 'default'}
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
