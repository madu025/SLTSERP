"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    BarChart, Bar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    LineChart, Line, AreaChart, Area 
} from 'recharts';
import { toast } from 'sonner';
import { 
    Sliders, Database, Filter, Sigma, Play, Download, Plus, Trash, AlertCircle, FileSpreadsheet 
} from 'lucide-react';

interface FilterRow {
    field: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'startsWith';
    value: string;
}

export default function DynamicReportPage() {
    const [entity, setEntity] = useState<string>('serviceOrder');
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [filters, setFilters] = useState<FilterRow[]>([]);
    
    // Aggregations
    const [useAggregation, setUseAggregation] = useState<boolean>(false);
    const [groupBy, setGroupBy] = useState<string>('');
    const [targetField, setTargetField] = useState<string>('');
    const [aggType, setAggType] = useState<string>('SUM');

    // Query Results
    const [loading, setLoading] = useState<boolean>(false);
    const [reportResult, setReportResult] = useState<{
        type: 'STANDARD' | 'AGGREGATED';
        columns: string[];
        rows: any[];
    } | null>(null);

    // Chart Configuration States
    const [chartType, setChartType] = useState<'BAR' | 'LINE' | 'AREA'>('BAR');
    const [xAxisKey, setXAxisKey] = useState<string>('');
    const [yAxisKey, setYAxisKey] = useState<string>('');

    // Auto-select chart axis keys when report results populate
    useEffect(() => {
        if (reportResult && reportResult.columns.length > 0) {
            setXAxisKey(reportResult.columns[0]);
            // Find a numeric column if possible for Y-axis, or pick the second column
            const numericCol = reportResult.columns.find(c => {
                const sampleVal = reportResult.rows[0]?.[c];
                return typeof sampleVal === 'number' || (typeof sampleVal === 'string' && !isNaN(Number(sampleVal)));
            });
            setYAxisKey(numericCol || reportResult.columns[1] || reportResult.columns[0]);
        }
    }, [reportResult]);

    // Entity Column Metadata
    const columnsMeta: Record<string, Array<{ value: string; label: string }>> = {
        serviceOrder: [
            { value: 'soNum', label: 'Service Order #' },
            { value: 'status', label: 'SLT Status' },
            { value: 'sltsStatus', label: 'SLTS Status' },
            { value: 'customerName', label: 'Customer Name' },
            { value: 'voiceNumber', label: 'Voice Number' },
            { value: 'rtom', label: 'RTOM' },
            { value: 'completedDate', label: 'Completed Date' },
            { value: 'revenueAmount', label: 'Revenue Amount (LKR)' }
        ],
        materialUsage: [
            { value: 'serviceOrder.soNum', label: 'Service Order #' },
            { value: 'serviceOrder.sltsStatus', label: 'SOD Status' },
            { value: 'serviceOrder.rtom', label: 'RTOM' },
            { value: 'item.code', label: 'Material Code' },
            { value: 'item.name', label: 'Material Name' },
            { value: 'quantity', label: 'Quantity Used' },
            { value: 'unit', label: 'Unit' },
            { value: 'usageType', label: 'Usage Type' },
            { value: 'costPrice', label: 'Cost Price' },
            { value: 'unitPrice', label: 'Unit Price' }
        ],
        contractorStock: [
            { value: 'contractor.name', label: 'Contractor Name' },
            { value: 'item.code', label: 'Material Code' },
            { value: 'item.name', label: 'Material Name' },
            { value: 'quantity', label: 'Stock in Custody' },
            { value: 'updatedAt', label: 'Last Reconciled' }
        ],
        journalEntry: [
            { value: 'referenceId', label: 'Reference ID' },
            { value: 'referenceType', label: 'Reference Type' },
            { value: 'description', label: 'Description' },
            { value: 'date', label: 'Post Date' }
        ],
        wastage: [
            { value: 'contractor.name', label: 'Contractor (Target)' },
            { value: 'store.name', label: 'RTOM Store' },
            { value: 'month', label: 'Month' },
            { value: 'status', label: 'Approval Status' },
            { value: 'description', label: 'Description/Incident Details' }
        ]
    };

    // Auto-select columns when entity changes
    useEffect(() => {
        const defaultCols = columnsMeta[entity]?.slice(0, 4).map(c => c.value) || [];
        setSelectedColumns(defaultCols);
        setFilters([]);
        setUseAggregation(false);
        setGroupBy('');
        setTargetField('');
        setReportResult(null);
    }, [entity]);

    const handleColumnToggle = (colVal: string) => {
        setSelectedColumns(prev => 
            prev.includes(colVal) ? prev.filter(c => c !== colVal) : [...prev, colVal]
        );
    };

    const handleAddFilter = () => {
        const fields = columnsMeta[entity] || [];
        if (fields.length > 0) {
            setFilters(prev => [...prev, { field: fields[0].value, operator: 'equals', value: '' }]);
        }
    };

    const handleRemoveFilter = (index: number) => {
        setFilters(prev => prev.filter((_, i) => i !== index));
    };

    const handleFilterChange = (index: number, key: keyof FilterRow, val: string) => {
        setFilters(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [key]: val } as FilterRow;
            return next;
        });
    };

    const handleRunReport = async () => {
        if (selectedColumns.length === 0 && !useAggregation) {
            return toast.error("Select at least one column to display.");
        }
        if (useAggregation && (!groupBy || !targetField)) {
            return toast.error("Specify Group By and Target aggregation fields.");
        }

        setLoading(true);
        try {
            const userId = localStorage.getItem("erp_user_id") || "";
            const role = localStorage.getItem("erp_user_role") || "";

            const payload = {
                entity,
                columns: selectedColumns,
                filters,
                aggregation: useAggregation ? {
                    groupBy,
                    targetField,
                    type: aggType
                } : undefined
            };

            const res = await fetch('/api/admin/reports/dynamic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-role': role
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message || result.error || 'Failed to generate report');

            setReportResult(result.data);
            toast.success("Report generated successfully!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!reportResult || reportResult.rows.length === 0) return;

        const headers = reportResult.columns.join(',');
        const csvRows = reportResult.rows.map(row => 
            reportResult.columns.map(col => {
                const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
                // Escape double quotes and commas
                return `"${val.replace(/"/g, '""')}"`;
            }).join(',')
        );

        const csvContent = [headers, ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dynamic_report_${entity}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderColumnLabel = (colName: string) => {
        const found = columnsMeta[entity]?.find(c => c.value === colName);
        return found ? found.label : colName.replace(/_/g, ' ').toUpperCase();
    };

    return (
        <div className="erp-page-wrapper flex-row overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {/* Heading */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <Sliders className="w-5 h-5 text-emerald-600 animate-pulse" />
                                    Dynamic Report Engine
                                </h1>
                                <p className="text-xs text-slate-500">Configure parameters, filter records, and aggregate inventory attributes on-demand.</p>
                            </div>
                        </div>

                        {/* Top Panel Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            
                            {/* --- CONFIGURATION PANEL (4 Columns) --- */}
                            <div className="lg:col-span-4 space-y-6">
                                <Card className="border-slate-200 bg-white shadow-sm">
                                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                                        <CardTitle className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 tracking-wider">
                                            <Database className="w-4 h-4 text-emerald-600" />
                                            Attributes & Query Logic
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        
                                        {/* Entity Selection */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Dataset</Label>
                                            <Select value={entity} onValueChange={setEntity}>
                                                <SelectTrigger className="bg-white h-8 text-xs border-slate-200">
                                                    <SelectValue placeholder="Select base dataset" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="serviceOrder" className="text-xs">Service Orders (SOD)</SelectItem>
                                                    <SelectItem value="materialUsage" className="text-xs">Material Consumptions</SelectItem>
                                                    <SelectItem value="contractorStock" className="text-xs">Contractor Stocks</SelectItem>
                                                    <SelectItem value="journalEntry" className="text-xs">General Ledger Postings</SelectItem>
                                                    <SelectItem value="wastage" className="text-xs">Wastage / Incident Logs</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Columns Selection */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report Columns ({selectedColumns.length})</Label>
                                            <div className="border border-slate-100 rounded-lg p-2 max-h-[160px] overflow-y-auto space-y-1.5 bg-slate-50/20">
                                                {columnsMeta[entity]?.map(col => (
                                                    <div key={col.value} className="flex items-center gap-2">
                                                        <Checkbox 
                                                            id={`col-${col.value}`} 
                                                            checked={selectedColumns.includes(col.value)} 
                                                            onCheckedChange={() => handleColumnToggle(col.value)} 
                                                            disabled={useAggregation && col.value !== groupBy}
                                                        />
                                                        <label htmlFor={`col-${col.value}`} className="text-xs text-slate-700 cursor-pointer select-none leading-none">
                                                            {col.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Aggregations */}
                                        <div className="space-y-2 border-t pt-3">
                                            <div className="flex items-center gap-2">
                                                <Checkbox 
                                                    id="toggle-agg" 
                                                    checked={useAggregation} 
                                                    onCheckedChange={(checked) => {
                                                        setUseAggregation(!!checked);
                                                        if (checked) {
                                                            setSelectedColumns([]);
                                                            setGroupBy('');
                                                        }
                                                    }} 
                                                />
                                                <label htmlFor="toggle-agg" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                                                    <Sigma className="w-3.5 h-3.5 text-emerald-600" /> Apply Group Aggregations
                                                </label>
                                            </div>

                                            {useAggregation && (
                                                <div className="bg-slate-50/60 p-2 border rounded-lg space-y-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black text-slate-400 uppercase">Group By Field</Label>
                                                        <Select value={groupBy} onValueChange={(val) => {
                                                            setGroupBy(val);
                                                            setSelectedColumns([val]);
                                                        }}>
                                                            <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue placeholder="Group by Field" /></SelectTrigger>
                                                            <SelectContent>
                                                                {columnsMeta[entity]?.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black text-slate-400 uppercase">Action</Label>
                                                            <Select value={aggType} onValueChange={setAggType}>
                                                                <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="SUM" className="text-xs">SUM</SelectItem>
                                                                    <SelectItem value="AVG" className="text-xs">AVG</SelectItem>
                                                                    <SelectItem value="COUNT" className="text-xs">COUNT</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black text-slate-400 uppercase">Target Field</Label>
                                                            <Select value={targetField} onValueChange={setTargetField}>
                                                                <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue placeholder="Measure" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {columnsMeta[entity]?.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Button */}
                                        <Button 
                                            onClick={handleRunReport} 
                                            disabled={loading} 
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-8 text-xs font-bold flex items-center justify-center gap-1.5"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            {loading ? 'Compiling Report...' : 'Compile & Generate Report'}
                                        </Button>

                                    </CardContent>
                                </Card>
                            </div>

                            {/* --- QUERY FILTERS AND OUTPUT PANEL (8 Columns) --- */}
                            <div className="lg:col-span-8 space-y-6">
                                
                                {/* Filters Builder Card */}
                                <Card className="border-slate-200 bg-white shadow-sm">
                                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                                        <CardTitle className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 tracking-wider">
                                            <Filter className="w-4 h-4 text-emerald-600" />
                                            Custom Query Rules (Filters)
                                        </CardTitle>
                                        <Button onClick={handleAddFilter} size="sm" variant="outline" className="h-6 text-[10px] font-bold border-slate-200"><Plus className="w-3 h-3 mr-1" /> Add Rule</Button>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3">
                                        {filters.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-xs italic">
                                                No filter rules added. All matching records will be fetched.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {filters.map((filter, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        {/* Field Select */}
                                                        <div className="w-[35%]">
                                                            <Select value={filter.field} onValueChange={(val) => handleFilterChange(idx, 'field', val)}>
                                                                <SelectTrigger className="bg-white h-8 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {columnsMeta[entity]?.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Operator Select */}
                                                        <div className="w-[25%]">
                                                            <Select value={filter.operator} onValueChange={(val) => handleFilterChange(idx, 'operator', val as any)}>
                                                                <SelectTrigger className="bg-white h-8 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="equals" className="text-xs">equals</SelectItem>
                                                                    <SelectItem value="contains" className="text-xs">contains</SelectItem>
                                                                    <SelectItem value="startsWith" className="text-xs">starts with</SelectItem>
                                                                    <SelectItem value="gt" className="text-xs">greater than</SelectItem>
                                                                    <SelectItem value="lt" className="text-xs">less than</SelectItem>
                                                                    <SelectItem value="gte" className="text-xs">greater than or equal</SelectItem>
                                                                    <SelectItem value="lte" className="text-xs">less than or equal</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Value Input */}
                                                        <div className="flex-1">
                                                            <Input 
                                                                placeholder="value..." 
                                                                value={filter.value} 
                                                                onChange={(e) => handleFilterChange(idx, 'value', e.target.value)}
                                                                className="h-8 text-xs bg-white border-slate-200"
                                                            />
                                                        </div>

                                                        {/* Trash Button */}
                                                        <Button onClick={() => handleRemoveFilter(idx)} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-md">
                                                            <Trash className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Dynamic Table Results Card with Chart Switcher */}
                                <Card className="border-slate-200 bg-white shadow-sm min-h-[300px] flex flex-col">
                                    <Tabs defaultValue="table" className="w-full flex flex-col flex-1">
                                        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20">
                                            <div className="flex items-center gap-4">
                                                <CardTitle className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 tracking-wider">
                                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                                    Report Output
                                                </CardTitle>
                                                {reportResult && (
                                                    <TabsList className="h-7 p-0.5 bg-slate-200 rounded-md">
                                                        <TabsTrigger value="table" className="text-[10px] px-2 h-6 font-bold">Table View</TabsTrigger>
                                                        <TabsTrigger value="chart" className="text-[10px] px-2 h-6 font-bold">Visual Chart</TabsTrigger>
                                                    </TabsList>
                                                )}
                                            </div>
                                            {reportResult && reportResult.rows.length > 0 && (
                                                <Button 
                                                    onClick={handleExportCSV} 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 text-[10px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1.5 align-self-end sm:align-self-auto"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> Export CSV
                                                </Button>
                                            )}
                                        </CardHeader>

                                        <TabsContent value="table" className="flex-1 m-0">
                                            <div className="overflow-x-auto">
                                                {!reportResult ? (
                                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                                                        <Sliders className="w-8 h-8 text-slate-300 animate-pulse" />
                                                        <span className="text-xs">Select options and click 'Compile & Generate Report' to populate table.</span>
                                                    </div>
                                                ) : reportResult.rows.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                                                        <AlertCircle className="w-8 h-8 text-amber-300" />
                                                        <span className="text-xs">No records found matching the configured query parameters.</span>
                                                    </div>
                                                ) : (
                                                    <Table>
                                                        <TableHeader className="bg-slate-50 border-b border-slate-200">
                                                            <TableRow className="hover:bg-transparent">
                                                                {reportResult.columns.map(col => (
                                                                    <TableHead key={col} className="h-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2">
                                                                        {renderColumnLabel(col)}
                                                                    </TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {reportResult.rows.map((row, idx) => (
                                                                <TableRow key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                                    {reportResult.columns.map(col => (
                                                                        <TableCell key={col} className="py-2 text-slate-700 text-xs font-medium">
                                                                            {row[col] === null || row[col] === undefined ? '---' : String(row[col])}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="chart" className="flex-1 m-0 p-4 space-y-4">
                                            {reportResult && reportResult.rows.length > 0 ? (
                                                <div className="space-y-4">
                                                    {/* Chart Setup Config */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black text-slate-400 uppercase">Chart Type</Label>
                                                            <Select value={chartType} onValueChange={(val: any) => setChartType(val)}>
                                                                <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="BAR" className="text-xs">Bar Chart</SelectItem>
                                                                    <SelectItem value="LINE" className="text-xs">Line Chart</SelectItem>
                                                                    <SelectItem value="AREA" className="text-xs">Area Chart</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black text-slate-400 uppercase">X-Axis Field</Label>
                                                            <Select value={xAxisKey} onValueChange={setXAxisKey}>
                                                                <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {reportResult.columns.map(c => <SelectItem key={c} value={c} className="text-xs">{renderColumnLabel(c)}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black text-slate-400 uppercase">Y-Axis (Value)</Label>
                                                            <Select value={yAxisKey} onValueChange={setYAxisKey}>
                                                                <SelectTrigger className="bg-white h-7 text-xs border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {reportResult.columns.map(c => <SelectItem key={c} value={c} className="text-xs">{renderColumnLabel(c)}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {/* Chart Visual Renders */}
                                                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-center min-h-[350px]">
                                                        {chartType === 'BAR' && (
                                                            <ResponsiveContainer width="100%" height={350}>
                                                                <BarChart data={reportResult.rows}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                    <RechartsXAxis dataKey={xAxisKey} tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <RechartsYAxis tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                                                    <Bar dataKey={yAxisKey} fill="#059669" radius={[4, 4, 0, 0]} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        )}
                                                        {chartType === 'LINE' && (
                                                            <ResponsiveContainer width="100%" height={350}>
                                                                <LineChart data={reportResult.rows}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                    <RechartsXAxis dataKey={xAxisKey} tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <RechartsYAxis tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                                                    <Line type="monotone" dataKey={yAxisKey} stroke="#059669" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        )}
                                                        {chartType === 'AREA' && (
                                                            <ResponsiveContainer width="100%" height={350}>
                                                                <AreaChart data={reportResult.rows}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                    <RechartsXAxis dataKey={xAxisKey} tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <RechartsYAxis tickLine={false} axisLine={false} style={{ fontSize: '10px' }} stroke="#64748b" />
                                                                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                                                    <Area type="monotone" dataKey={yAxisKey} stroke="#059669" fill="#d1fae5" strokeWidth={2} />
                                                                </AreaChart>
                                                            </ResponsiveContainer>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                                    No data available for charting.
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </Card>

                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
