"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  ArrowLeftRight, 
  RefreshCw, 
  TrendingDown, 
  Plus, 
  Search, 
  FileText, 
  CheckCircle,
  Truck,
  Box,
  CornerDownLeft,
  Cpu,
  Layers,
  X
} from "lucide-react";

interface IRLedgerEntry {
  irNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  itemUnit: string;
  receivedQty: number;
  issuedQty: number;
  returnedQty: number;
  transferredOutQty: number;
  transferredInQty: number;
  wastedQty: number;
  sltReturnedQty: number;
  leftoverQty: number;
  projectId?: string;
  projectName?: string;
  wastageRate?: number;
  boqPlannedQty?: number;
  boqVarianceRate?: number;
}

interface AITrainingMetric {
  projectId: string;
  projectName: string;
  projectCode: string;
  hasPlanned: boolean;
  hasFieldChange: boolean;
  hasBeforePat: boolean;
  hasAsBuilt: boolean;
  planned: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
  };
  fieldChange: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
  } | null;
  beforePat: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
  } | null;
  asBuilt: {
    polesCount: number;
    closuresCount: number;
    cableLength: number;
  } | null;
  deviations: {
    polesDiff: number;
    closuresDiff: number;
    cableLengthDiff: number;
    avgDisplacementMeters: number;
    heightUpgrades: number;
  } | null;
}

interface Project { id: string; name: string; projectCode: string; }
interface Store { id: string; name: string; type: string; }
interface Item { id: string; name: string; code: string; category: string; unit: string; }
interface BatchStock {
  batchId: string;
  batchNumber: string;
  irNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  storeId: string;
}

export default function IRAuditDashboard() {
  const [ledger, setLedger] = useState<IRLedgerEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);
  const [batchStocks, setBatchStocks] = useState<BatchStock[]>([]);
  const [storeBatchStocks, setStoreBatchStocks] = useState<BatchStock[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [currentTab, setCurrentTab] = useState<'LEDGER' | 'AI_TRAINING'>('LEDGER');
  const [aiTrainingMetrics, setAiTrainingMetrics] = useState<AITrainingMetric[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Active Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    irNumber: "",
    storeId: "",
    itemId: "",
    batchId: "",
    quantity: 0,
    sourceProjectId: "",
    destProjectId: "",
    remarks: "",
    contractorId: "",
    gatepassNumber: ""
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedIrHistory, setSelectedIrHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeHistoryIr, setActiveHistoryIr] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const projParam = selectedProjectId !== "ALL" ? `&projectId=${selectedProjectId}` : "";
      const res = await fetch(`/api/projects/ir-ledger?meta=true${projParam}`);
      if (res.ok) {
        const json = await res.json();
        setLedger(json.ledger || []);
        setProjects(json.projects || []);
        setStores(json.stores || []);
        setItems(json.items || []);
        setContractors(json.contractors || []);
        setBatchStocks(json.batchStocks || []);
        setStoreBatchStocks(json.storeBatchStocks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadIrHistory = async (irNumber: string) => {
    setHistoryLoading(true);
    setActiveHistoryIr(irNumber);
    try {
      const res = await fetch(`/api/projects/ir-ledger?history=true&irNumber=${irNumber}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIrHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAITrainingData = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/gis/ai-training?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setAiTrainingMetrics(json || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    if (currentTab === 'AI_TRAINING') {
      loadAITrainingData();
    }
  }, [currentTab]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAction = async (endpoint: string, payload: any) => {
    setSubmitLoading(true);
    try {
      const res = await fetch(`/api/projects/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setActiveModal(null);
        setFormData({
          irNumber: "",
          storeId: "",
          itemId: "",
          batchId: "",
          quantity: 0,
          sourceProjectId: "",
          destProjectId: "",
          remarks: "",
          contractorId: "",
          gatepassNumber: ""
        });
        loadData();
      } else {
        const text = await res.text();
        alert(`Error: ${text}`);
      }
    } catch (e) {
      console.error(e);
      alert("Something went wrong");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Aggregated KPIs
  const totalReceived = ledger.reduce((acc, curr) => acc + curr.receivedQty, 0);
  const totalIssued = ledger.reduce((acc, curr) => acc + curr.issuedQty, 0);
  const totalWasted = ledger.reduce((acc, curr) => acc + curr.wastedQty, 0);
  const totalLeftover = ledger.reduce((acc, curr) => acc + curr.leftoverQty, 0);

  // Filtered Ledger
  const filteredLedger = ledger.filter(entry => {
    const matchesSearch = 
      entry.irNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "ALL" || entry.itemCategory === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Filter leftovers of the selected source project context
  const projectLeftovers = ledger.filter(entry => 
    entry.projectId === formData.sourceProjectId && 
    entry.leftoverQty > 0
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5 space-y-4">
          <div className="max-w-7xl mx-auto w-full space-y-4">
            
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  IR Material Audit & Tracking
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inspection Receipt (IR) material ledger, leftovers, project transfers, returns and wastage.
                </p>
              </div>

              {/* Project Filter Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Project:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-background border border-input text-foreground text-xs rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">All Projects (Global Stores View)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="default" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("RECEIPT")}>
                <Plus className="w-3.5 h-3.5" />
                Record SLT IR Receipt
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("ISSUE")}>
                <Box className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Issue Material to Project
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("RETURN")}>
                <CornerDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Return Leftover to Store
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("TRANSFER")}>
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Project-to-Project Transfer
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("SLT_RETURN")}>
                <RefreshCw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Return back to SLT
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7.5 gap-1.5" onClick={() => setActiveModal("WASTAGE")}>
                <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                Report Wastage
              </Button>
            </div>

            {/* KPI Dashboard Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Received</p>
                    <p className="text-lg font-bold mt-0.5">{totalReceived.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Across all IR receipts</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Issued to Project</p>
                    <p className="text-lg font-bold mt-0.5">{totalIssued.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Dispatched to site</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Wastage</p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{totalWasted.toLocaleString()}</p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Material write-off</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">In Hand / Leftover</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-0.5">{totalLeftover.toLocaleString()}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Available balance</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tab selector buttons */}
            <div className="flex border-b border-border/40 gap-4 mb-4">
              <button
                onClick={() => setCurrentTab('LEDGER')}
                className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  currentTab === 'LEDGER'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                IR Material Ledger
              </button>
              <button
                onClick={() => setCurrentTab('AI_TRAINING')}
                className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  currentTab === 'AI_TRAINING'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                AI Model Training & Deviation Analyzer
              </button>
            </div>

            {currentTab === 'LEDGER' ? (
              <>
                {/* Filters & Search controls */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search IR Number, Item, Code..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-background border border-input rounded-md py-1.5 pl-8.5 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground shrink-0">Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="bg-background border border-input text-foreground text-xs rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="ALL">All Categories</option>
                      <option value="Cables">Cables</option>
                      <option value="Closures">Closures</option>
                      <option value="PatchPanels">Patch Panels</option>
                    </select>
                  </div>
                </div>

                {/* Audit Ledger Grid Card */}
                <Card>
                  <CardHeader className="pb-2 border-b border-border/40">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                      IR Material Balances Ledger
                    </CardTitle>
                    <CardDescription className="text-[10px] text-muted-foreground">
                      Ledger tracking of SLT Inspection Receipt material flow.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/40 text-left text-[10px] font-semibold text-muted-foreground uppercase">
                            <th className="px-3 py-2.5">IR Reference</th>
                            <th className="px-3 py-2.5">Item Code</th>
                            <th className="px-3 py-2.5">Item Description</th>
                            <th className="px-3 py-2.5 text-right">{selectedProjectId !== "ALL" ? "BOQ Est." : "Received"}</th>
                            <th className="px-3 py-2.5 text-right">Issued</th>
                            <th className="px-3 py-2.5 text-right">Wasted</th>
                            <th className="px-3 py-2.5 text-right">Returned</th>
                            <th className="px-3 py-2.5 text-right">Transferred</th>
                            <th className="px-3 py-2.5 text-right">Leftover</th>
                            <th className="px-3 py-2.5 text-right">Wastage %</th>
                            <th className="px-3 py-2.5 text-right">{selectedProjectId !== "ALL" ? "BOQ Var." : ""}</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {loading ? (
                            <tr>
                              <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                                Loading IR Ledger data...
                              </td>
                            </tr>
                          ) : filteredLedger.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                                No audit ledger entries found matching the criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredLedger.map((entry, idx) => (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2.5 font-mono font-semibold text-foreground">{entry.irNumber}</td>
                                <td className="px-3 py-2.5 text-muted-foreground">{entry.itemCode}</td>
                                <td className="px-3 py-2.5 font-medium text-foreground">
                                  {entry.itemName}
                                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{entry.itemCategory}</div>
                                </td>
                                <td className="px-3 py-2.5 text-right text-muted-foreground font-medium">
                                  {selectedProjectId !== "ALL" ? (
                                    <span>{entry.boqPlannedQty || 0} {entry.itemUnit}</span>
                                  ) : (
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">{entry.receivedQty} {entry.itemUnit}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right text-indigo-600 dark:text-indigo-400">{entry.issuedQty} {entry.itemUnit}</td>
                                <td className="px-3 py-2.5 text-right text-rose-600 dark:text-rose-400">{entry.wastedQty} {entry.itemUnit}</td>
                                <td className="px-3 py-2.5 text-right text-green-600 dark:text-green-400">{entry.returnedQty + entry.sltReturnedQty} {entry.itemUnit}</td>
                                <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                                  {entry.transferredInQty > 0 && <div className="text-green-600 dark:text-green-400 text-[10px]">+{entry.transferredInQty}</div>}
                                  {entry.transferredOutQty > 0 && <div className="text-red-600 dark:text-red-400 text-[10px]">-{entry.transferredOutQty}</div>}
                                  {entry.transferredInQty === 0 && entry.transferredOutQty === 0 && "-"}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold text-foreground">
                                  {entry.leftoverQty} {entry.itemUnit}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {entry.wastageRate !== undefined ? (
                                    <span className={`font-semibold inline-flex items-center gap-1 ${
                                      entry.wastageRate > 5 
                                        ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                                        : 'text-muted-foreground'
                                    }`}>
                                      {entry.wastageRate}%
                                      {entry.wastageRate > 5 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse" title="High Wastage Alert! (>5%)" />
                                      )}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {selectedProjectId !== "ALL" && entry.boqVarianceRate !== undefined ? (
                                    <span className={`font-semibold inline-flex items-center gap-1 ${
                                      entry.boqVarianceRate > 100 
                                        ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
                                        : entry.boqVarianceRate > 80
                                        ? 'text-amber-500 font-semibold'
                                        : 'text-muted-foreground'
                                    }`}>
                                      {entry.boqVarianceRate}%
                                      {entry.boqVarianceRate > 100 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-ping" title="Over BOQ Budget Ceiling! (>100%)" />
                                      )}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <Badge 
                                    variant={entry.leftoverQty === 0 ? "secondary" : "default"} 
                                    className={`text-[9px] tracking-wide uppercase ${
                                      entry.leftoverQty > 0 ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" : ""
                                    }`}
                                  >
                                    {entry.leftoverQty > 0 ? "Available" : "Consumed"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[10px] h-6 px-2"
                                    onClick={() => loadIrHistory(entry.irNumber)}
                                  >
                                    Audit Trail
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="space-y-4">
                {/* AI Model Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-500/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Dataset Projects</p>
                        <p className="text-xl font-bold mt-0.5">{aiTrainingMetrics.length}</p>
                        <p className="text-[9px] text-muted-foreground">Poles & cables evaluated</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <Cpu className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Model Accuracy</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                          {aiTrainingMetrics.length > 0 ? (
                            `${Math.round((1 - (aiTrainingMetrics.filter(m => m.deviations && m.deviations.avgDisplacementMeters > 3).length / aiTrainingMetrics.length)) * 100)}%`
                          ) : (
                            "100%"
                          )}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Within 3.0m displacement</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Avg. Snap displacement</p>
                        <p className="text-xl font-bold mt-0.5">
                          {aiTrainingMetrics.length > 0 ? (
                            `${(aiTrainingMetrics.reduce((sum, m) => sum + (m.deviations?.avgDisplacementMeters || 0), 0) / aiTrainingMetrics.length).toFixed(1)}m`
                          ) : (
                            "0.0m"
                          )}
                        </p>
                        <p className="text-[9px] text-muted-foreground">OSM snap learning drift</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-rose-500/5 to-pink-500/5 border-rose-500/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                        <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Height corrections</p>
                        <p className="text-xl font-bold mt-0.5">
                          {aiTrainingMetrics.reduce((sum, m) => sum + (m.deviations?.heightUpgrades || 0), 0)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">AI planned pole height upgrades</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Training Dataset Comparison Table */}
                <Card>
                  <CardHeader className="pb-2 border-b border-border/40">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      Mother Drawing Model Training Datasets
                    </CardTitle>
                    <CardDescription className="text-[10px] text-muted-foreground">
                      Deviation check across OSP lifecycle: Planned (AI auto-plan) vs. Surveyed (QField) vs. As-Built. The model trains automatically as deviations converge.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase text-left">
                            <th className="px-3 py-2.5">Project Code</th>
                            <th className="px-3 py-2.5">Project Name</th>
                            <th className="px-3 py-2.5 text-center">AI Planned</th>
                            <th className="px-3 py-2.5 text-center">QField Survey</th>
                            <th className="px-3 py-2.5 text-center">Before PAT</th>
                            <th className="px-3 py-2.5 text-center">As-Built</th>
                            <th className="px-3 py-2.5 text-right">Cable Dev.</th>
                            <th className="px-3 py-2.5 text-right">Poles Dev.</th>
                            <th className="px-3 py-2.5 text-right">Avg. Displacement</th>
                            <th className="px-3 py-2.5 text-center">Model Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {aiLoading ? (
                            <tr>
                              <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                                Calculating comparative deviation metrics across projects...
                              </td>
                            </tr>
                          ) : aiTrainingMetrics.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                                No historical route versions found to train the model.
                              </td>
                            </tr>
                          ) : (
                            aiTrainingMetrics.map((m, idx) => {
                              const displacement = m.deviations?.avgDisplacementMeters || 0;
                              let statusLabel = "DEVIATED";
                              let statusStyle = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
                              if (displacement > 0 && displacement < 2.5) {
                                statusLabel = "OPTIMIZED";
                                statusStyle = "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20";
                              } else if (displacement >= 2.5 && displacement < 6.0) {
                                statusLabel = "IN_TRAINING";
                                statusStyle = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20";
                              }

                              return (
                                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-3 py-2.5 font-mono font-semibold text-foreground">{m.projectCode}</td>
                                  <td className="px-3 py-2.5 font-medium text-foreground">{m.projectName}</td>
                                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                                    {m.planned.polesCount}P / {m.planned.closuresCount}C / {m.planned.cableLength}m
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-indigo-600 dark:text-indigo-400 font-semibold">
                                    {m.fieldChange ? (
                                      `${m.fieldChange.polesCount}P / ${m.fieldChange.closuresCount}C / ${m.fieldChange.cableLength}m`
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-amber-600 dark:text-amber-400 font-semibold">
                                    {m.beforePat ? (
                                      `${m.beforePat.polesCount}P / ${m.beforePat.closuresCount}C / ${m.beforePat.cableLength}m`
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {m.asBuilt ? (
                                      `${m.asBuilt.polesCount}P / ${m.asBuilt.closuresCount}C / ${m.asBuilt.cableLength}m`
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className={`px-3 py-2.5 text-right font-semibold ${m.deviations?.cableLengthDiff && m.deviations.cableLengthDiff > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                                    {m.deviations ? `${m.deviations.cableLengthDiff > 0 ? '+' : ''}${m.deviations.cableLengthDiff}m` : "-"}
                                  </td>
                                  <td className={`px-3 py-2.5 text-right font-semibold ${m.deviations?.polesDiff && m.deviations.polesDiff > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                                    {m.deviations ? `${m.deviations.polesDiff > 0 ? '+' : ''}${m.deviations.polesDiff} poles` : "-"}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                                    {m.deviations ? `${m.deviations.avgDisplacementMeters}m` : "-"}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <Badge className={`text-[9px] tracking-wide uppercase ${statusStyle}`} variant="outline">
                                      {statusLabel}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODALS --- */}

      {/* 1. Add IR Receipt Modal */}
      {activeModal === "RECEIPT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Record Incoming SLT IR Receipt</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">IR Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. IR-2026-0041"
                  value={formData.irNumber}
                  onChange={e => setFormData({ ...formData, irNumber: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Store Location</label>
                <select
                  value={formData.storeId}
                  onChange={e => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Material Item</label>
                <select
                  value={formData.itemId}
                  onChange={e => setFormData({ ...formData, itemId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Material</option>
                  {items.map(i => <option key={i.id} value={i.id}>[{i.code}] {i.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Received Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading} onClick={() => handleAction("ir-ledger", {
                irNumber: formData.irNumber,
                storeId: formData.storeId,
                items: [{ itemId: formData.itemId, quantity: formData.quantity }]
              })}>
                {submitLoading ? "Saving..." : "Save Receipt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Issue Material Modal */}
      {activeModal === "ISSUE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Issue Material to Project</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Target Project</label>
                <select
                  value={formData.destProjectId}
                  onChange={e => setFormData({ ...formData, destProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Available Store IR Batches</label>
                <select
                  value={formData.batchId}
                  onChange={e => {
                    const bs = storeBatchStocks.find(b => b.batchId === e.target.value);
                    setFormData({ 
                      ...formData, 
                      batchId: e.target.value,
                      itemId: bs?.itemId || "",
                      storeId: bs?.storeId || ""
                    });
                  }}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select IR Batch (Store)</option>
                  {storeBatchStocks.map(bs => {
                    const storeName = stores.find(s => s.id === bs.storeId)?.name || 'Store';
                    return (
                      <option key={bs.batchId} value={bs.batchId}>
                        {bs.irNumber} - [{bs.itemCode}] {bs.itemName} ({bs.quantity} left in {storeName})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Issue Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Attributed Contractor</label>
                <select
                  value={formData.contractorId}
                  onChange={e => setFormData({ ...formData, contractorId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Contractor (Optional)</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Issued for main trunk line installation"
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading} onClick={() => handleAction("ir-return", {
                transactionType: "PROJECT_ISSUE",
                projectId: formData.destProjectId,
                storeId: formData.storeId,
                batchId: formData.batchId,
                itemId: formData.itemId,
                quantity: formData.quantity,
                remarks: formData.remarks,
                contractorId: formData.contractorId
              })}>
                {submitLoading ? "Processing..." : "Issue Material"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Return Material Modal */}
      {activeModal === "RETURN" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Return Leftover to Store</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Source Project</label>
                <select
                  value={formData.sourceProjectId}
                  onChange={e => setFormData({ ...formData, sourceProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Return Store Location</label>
                <select
                  value={formData.storeId}
                  onChange={e => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Original IR Item Batch</label>
                <select
                  value={`${ledger.find(e => e.itemId === formData.itemId && e.irNumber === ledger.find(le => le.itemId === formData.itemId)?.irNumber)?.irNumber || ''}_${formData.itemId}`}
                  onChange={e => {
                    const [irNumber, itemId] = e.target.value.split('_');
                    const bs = batchStocks.find(b => b.irNumber === irNumber && b.itemId === itemId);
                    setFormData({ 
                      ...formData, 
                      batchId: bs?.batchId || "",
                      itemId: itemId || "",
                      storeId: bs?.storeId || ""
                    });
                  }}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="_">Select Material leftover from project</option>
                  {projectLeftovers.map(entry => (
                    <option key={`${entry.irNumber}_${entry.itemId}`} value={`${entry.irNumber}_${entry.itemId}`}>
                      {entry.irNumber} - [{entry.itemCode}] {entry.itemName} ({entry.leftoverQty} {entry.itemUnit} left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Returned Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Leftover cores after splicing completion"
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading} onClick={() => handleAction("ir-return", {
                transactionType: "PROJECT_RETURN",
                projectId: formData.sourceProjectId,
                storeId: formData.storeId,
                batchId: formData.batchId,
                itemId: formData.itemId,
                quantity: formData.quantity,
                remarks: formData.remarks
              })}>
                {submitLoading ? "Processing..." : "Process Return"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Project to Project Transfer Modal */}
      {activeModal === "TRANSFER" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Project-to-Project Material Transfer</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Source Project</label>
                <select
                  value={formData.sourceProjectId}
                  onChange={e => setFormData({ ...formData, sourceProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Source Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Destination Project</label>
                <select
                  value={formData.destProjectId}
                  onChange={e => setFormData({ ...formData, destProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Destination Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">IR Batch to Transfer</label>
                <select
                  value={`${ledger.find(e => e.itemId === formData.itemId && e.irNumber === ledger.find(le => le.itemId === formData.itemId)?.irNumber)?.irNumber || ''}_${formData.itemId}`}
                  onChange={e => {
                    const [irNumber, itemId] = e.target.value.split('_');
                    const bs = batchStocks.find(b => b.irNumber === irNumber && b.itemId === itemId);
                    setFormData({ 
                      ...formData, 
                      batchId: bs?.batchId || "",
                      itemId: itemId || "",
                      storeId: bs?.storeId || ""
                    });
                  }}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="_">Select Material leftover from project</option>
                  {projectLeftovers.map(entry => (
                    <option key={`${entry.irNumber}_${entry.itemId}`} value={`${entry.irNumber}_${entry.itemId}`}>
                      {entry.irNumber} - [{entry.itemCode}] {entry.itemName} ({entry.leftoverQty} {entry.itemUnit} left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Leftover cable drums transferred for secondary ring OSP"
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading} onClick={() => handleAction("ir-transfer", {
                sourceProjectId: formData.sourceProjectId,
                destProjectId: formData.destProjectId,
                storeId: formData.storeId,
                batchId: formData.batchId,
                itemId: formData.itemId,
                quantity: formData.quantity,
                remarks: formData.remarks
              })}>
                {submitLoading ? "Processing..." : "Transfer Material"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Return to SLT Modal */}
      {activeModal === "SLT_RETURN" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Return Leftover back to SLT</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Source Project</label>
                <select
                  value={formData.sourceProjectId}
                  onChange={e => setFormData({ ...formData, sourceProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Store Context</label>
                <select
                  value={formData.storeId}
                  onChange={e => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">SLT IR Item Batch</label>
                <select
                  value={`${ledger.find(e => e.itemId === formData.itemId && e.irNumber === ledger.find(le => le.itemId === formData.itemId)?.irNumber)?.irNumber || ''}_${formData.itemId}`}
                  onChange={e => {
                    const [irNumber, itemId] = e.target.value.split('_');
                    const bs = batchStocks.find(b => b.irNumber === irNumber && b.itemId === itemId);
                    setFormData({ 
                      ...formData, 
                      batchId: bs?.batchId || "",
                      itemId: itemId || "",
                      storeId: bs?.storeId || ""
                    });
                  }}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="_">Select Material leftover from project</option>
                  {projectLeftovers.map(entry => (
                    <option key={`${entry.irNumber}_${entry.itemId}`} value={`${entry.irNumber}_${entry.itemId}`}>
                      {entry.irNumber} - [{entry.itemCode}] {entry.itemName} ({entry.leftoverQty} {entry.itemUnit} left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Return Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">SLT Gatepass Reference Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. GP-SLT-400123"
                  value={formData.gatepassNumber}
                  onChange={e => setFormData({ ...formData, gatepassNumber: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Remarks / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Return of unused/extra drums to SLT regional depot"
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading || !formData.gatepassNumber} onClick={() => handleAction("ir-return", {
                transactionType: "SLT_RETURN",
                projectId: formData.sourceProjectId,
                storeId: formData.storeId,
                batchId: formData.batchId,
                itemId: formData.itemId,
                quantity: formData.quantity,
                remarks: formData.remarks,
                gatepassNumber: formData.gatepassNumber
              })}>
                {submitLoading ? "Processing..." : "Confirm Return"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Wastage Report Modal */}
      {activeModal === "WASTAGE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border text-card-foreground rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-sm font-bold">Report Material Wastage</h3>
              <button onClick={() => setActiveModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Project Context</label>
                <select
                  value={formData.sourceProjectId}
                  onChange={e => setFormData({ ...formData, sourceProjectId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>[{p.projectCode}] {p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Store Location</label>
                <select
                  value={formData.storeId}
                  onChange={e => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">IR Batch Context</label>
                <select
                  value={`${ledger.find(e => e.itemId === formData.itemId && e.irNumber === ledger.find(le => le.itemId === formData.itemId)?.irNumber)?.irNumber || ''}_${formData.itemId}`}
                  onChange={e => {
                    const [irNumber, itemId] = e.target.value.split('_');
                    const bs = batchStocks.find(b => b.irNumber === irNumber && b.itemId === itemId);
                    setFormData({ 
                      ...formData, 
                      batchId: bs?.batchId || "",
                      itemId: itemId || "",
                      storeId: bs?.storeId || ""
                    });
                  }}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="_">Select Material leftover from project</option>
                  {projectLeftovers.map(entry => (
                    <option key={`${entry.irNumber}_${entry.itemId}`} value={`${entry.irNumber}_${entry.itemId}`}>
                      {entry.irNumber} - [{entry.itemCode}] {entry.itemName} ({entry.leftoverQty} {entry.itemUnit} left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Wasted Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Responsible Contractor</label>
                <select
                  value={formData.contractorId}
                  onChange={e => setFormData({ ...formData, contractorId: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select Contractor (Optional)</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Reason for Wastage</label>
                <input
                  type="text"
                  placeholder="e.g. Cut pieces left after pole splicing"
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-background border border-input text-xs rounded p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveModal(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={submitLoading} onClick={() => handleAction("ir-wastage", {
                projectId: formData.sourceProjectId,
                storeId: formData.storeId,
                batchId: formData.batchId,
                itemId: formData.itemId,
                quantity: formData.quantity,
                remarks: formData.remarks,
                contractorId: formData.contractorId
              })}>
                {submitLoading ? "Processing..." : "Report Wastage"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Audit Timeline Slide-out Drawer */}
      {activeHistoryIr && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-card border-l border-border text-card-foreground w-full max-w-lg h-full flex flex-col p-6 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Audit Timeline: {activeHistoryIr}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Chronological movement log of this Inspection Receipt</p>
              </div>
              <button onClick={() => setActiveHistoryIr(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {historyLoading ? (
                <div className="text-center py-12 text-xs text-muted-foreground">Loading audit history...</div>
              ) : selectedIrHistory.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">No movement history logged.</div>
              ) : (
                <div className="relative border-l border-border ml-3 pl-6 space-y-6">
                  {selectedIrHistory.map((item) => {
                    // Decide bullet color and icon
                    let color = "bg-blue-500 border-blue-400";
                    let actionLabel = item.type;
                    if (item.type === "GRN" || item.type === "GRN_IR") {
                      color = "bg-green-600 border-green-500 dark:border-green-400";
                      actionLabel = "SLT IR Material Received";
                    } else if (item.type === "PROJECT_ISSUE") {
                      color = "bg-indigo-600 border-indigo-500 dark:border-indigo-400";
                      actionLabel = "Issued to Project";
                    } else if (item.type === "PROJECT_RETURN") {
                      color = "bg-emerald-600 border-emerald-500 dark:border-emerald-400";
                      actionLabel = "Returned from Project";
                    } else if (item.type === "PROJECT_TRANSFER_OUT") {
                      color = "bg-amber-600 border-amber-500 dark:border-amber-400";
                      actionLabel = "Transferred Out of Project";
                    } else if (item.type === "PROJECT_TRANSFER_IN") {
                      color = "bg-teal-600 border-teal-500 dark:border-teal-400";
                      actionLabel = "Transferred Into Project";
                    } else if (item.type === "WASTAGE") {
                      color = "bg-rose-600 border-rose-500 dark:border-rose-400";
                      actionLabel = "Wastage Reported";
                    } else if (item.type === "SLT_RETURN") {
                      color = "bg-purple-600 border-purple-500 dark:border-purple-400";
                      actionLabel = "Returned to SLT";
                    }

                    return (
                      <div key={item.id} className="relative group">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[30px] top-1.5 w-4.5 h-4.5 rounded-full border-2 ${color} flex items-center justify-center shrink-0`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                        </div>

                        {/* Timeline content */}
                        <div className="bg-muted/30 border border-border/40 rounded-md p-3.5 hover:border-border transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">{actionLabel}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{new Date(item.date).toLocaleString()}</span>
                          </div>
                          
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-sm font-extrabold text-foreground">{item.quantity}</span>
                            <span className="text-[10px] text-muted-foreground">{item.itemUnit}</span>
                          </div>

                          <div className="text-[10px] text-muted-foreground mt-2 space-y-1">
                            <div><span className="text-muted-foreground font-semibold">Store:</span> {item.storeName}</div>
                            {item.projectName && (
                              <div><span className="text-muted-foreground font-semibold">Project:</span> {item.projectName}</div>
                            )}
                            {item.notes && (
                              <div className="italic text-muted-foreground bg-muted/60 p-1.5 rounded mt-1 border border-border/40">
                                &ldquo;{item.notes}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/40 flex justify-end">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setActiveHistoryIr(null)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
