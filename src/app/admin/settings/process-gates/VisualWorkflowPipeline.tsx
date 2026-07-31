'use client';

import React, { useState } from 'react';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';
import { 
  ArrowDown,
  ArrowRight,
  ShieldCheck, 
  Camera, 
  MapPin, 
  FileCheck, 
  FileText, 
  Receipt, 
  Settings2, 
  Plus, 
  Trash2,
  GitBranch,
  Sparkles,
  XCircle,
  Clock,
  Zap,
  Mail,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

export type GatePolicyWithLevels = ProcessGatePolicy & {
  approvalLevels: ProcessApprovalLevel[];
};

interface VisualWorkflowPipelineProps {
  entityType: string;
  gates: GatePolicyWithLevels[];
  onEditGate: (gate: GatePolicyWithLevels) => void;
  onOpenBuilder: (gate: GatePolicyWithLevels) => void;
  onDeleteGate: (id: string) => void;
  onAddNewGate: (defaultEntityType?: string) => void;
  onRefreshGates?: () => void;
}

export function VisualWorkflowPipeline({
  entityType,
  gates,
  onEditGate,
  onOpenBuilder,
  onDeleteGate,
  onAddNewGate,
  onRefreshGates,
}: VisualWorkflowPipelineProps) {
  const [seeding, setSeeding] = useState(false);

  // Filter gates for the selected entity type and sort in chronological sequence
  const rawGates = gates.filter(g => entityType === 'ALL' || g.entityType === entityType);
  
  const sortedGates: GatePolicyWithLevels[] = [];
  const remaining = [...rawGates];

  if (remaining.length > 0) {
    const toStatuses = new Set(remaining.map(g => g.toStatus));
    let current = remaining.find(g => !toStatuses.has(g.fromStatus)) || remaining[0];

    while (current && remaining.length > 0) {
      sortedGates.push(current);
      const idx = remaining.findIndex(g => g.id === current.id);
      if (idx !== -1) remaining.splice(idx, 1);
      
      const nextGate = remaining.find(g => g.fromStatus === current.toStatus);
      current = nextGate || remaining[0];
    }
  }

  const entityGates = sortedGates;

  const handleSeedTemplates = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/admin/process-gates/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load templates');
      toast.success('Industrial workflow templates loaded!');
      if (onRefreshGates) onRefreshGates();
    } catch (error) {
      console.error(error);
      toast.error('Failed to seed templates');
    } finally {
      setSeeding(false);
    }
  };

  // Build full lifecycle stage sequence for header
  const lifecycleStages = entityGates.length > 0 
    ? [entityGates[0].fromStatus, ...entityGates.map(g => g.toStatus)]
    : [];

  return (
    <div className="space-y-6 pb-10">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Compact End-to-End Decision Tree
          </div>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            {entityType === 'ALL' ? 'All Active Module Trees' : `${entityType.replace('_', ' ')} Lifecycle`}
            <span className="text-[11px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-medium flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {entityGates.length} Gate Nodes
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2 relative z-10 self-end md:self-auto">
          <button
            onClick={handleSeedTemplates}
            disabled={seeding}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Load Pre-configured Industrial Workflow Presets"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            {seeding ? 'Loading Presets...' : '1-Click Presets'}
          </button>
          <button
            onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-950 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Gate
          </button>
        </div>
      </div>

      {/* End-to-End Complete Lifecycle Summary Stepper Bar */}
      {lifecycleStages.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Complete End-to-End Lifecycle Stages
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {lifecycleStages.map((stage, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">{stage}</span>
                </div>
                {idx < lifecycleStages.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* No Gates Empty State */}
      {entityGates.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100 shadow-inner">
            <GitBranch className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Active Gate Policies</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto mt-1 mb-5">
            There are currently no gate rules for <span className="font-semibold text-slate-700">{entityType === 'ALL' ? 'this module' : entityType}</span>. You can load industrial default presets or create a custom gate.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleSeedTemplates}
              disabled={seeding}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-200"
            >
              <Zap className="w-4 h-4" />
              Load Industrial Template
            </button>
            <button
              onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Create Custom Gate
            </button>
          </div>
        </div>
      )}

      {/* Compact Tree Nodes Canvas */}
      <div className="relative w-full flex flex-col items-center pt-2">
        {entityGates.map((gate, index) => {
          const hasVerifications =
            gate.reqPhotoProof ||
            gate.reqGpsLocation ||
            gate.reqSltsPat ||
            gate.reqOpmcPat ||
            gate.reqHoPat ||
            gate.reqDocUpload ||
            gate.writeAuditLedger ||
            gate.generateIssueNote;

          return (
            <div key={gate.id} className="w-full flex flex-col items-center relative group">
              
              {/* Top incoming connector (except first node) */}
              {index > 0 && (
                <div className="w-[2px] h-6 bg-slate-300 relative flex justify-center z-0">
                  <div className="absolute top-1/2 -translate-y-1/2 bg-slate-100 rounded-full border border-slate-300 p-0.5">
                    <ArrowDown className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Compact Sleek Node Card */}
              <div className="w-full max-w-2xl bg-white border-2 border-indigo-200/90 shadow-md shadow-indigo-950/5 rounded-xl relative z-10 hover:border-indigo-400 transition-all p-3.5 sm:p-4">
                
                {/* Entry Point Status Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-900 text-white border border-indigo-700 px-3 py-0.5 rounded-full text-[10px] font-bold font-mono shadow-xs tracking-wider">
                  {gate.fromStatus}
                </div>

                {/* Top Bar: Gate Title & Actions */}
                <div className="flex items-center justify-between gap-2 pt-1 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase border border-slate-200">
                      GATE #{index + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                      {gate.label}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => onEditGate(gate)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit Gate">
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteGate(gate.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete Gate">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle: Compact Verifications & Actions Grid */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50/90 p-2 rounded-lg border border-slate-200/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase mr-1">Checks:</span>
                    {gate.reqPhotoProof && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3 text-blue-500" /> Photo
                      </span>
                    )}
                    {gate.reqGpsLocation && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-indigo-500" /> GPS
                      </span>
                    )}
                    {gate.reqSltsPat && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-purple-500" /> PAT
                      </span>
                    )}
                    {gate.writeAuditLedger && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Ledger
                      </span>
                    )}
                    {gate.generateIssueNote && (
                      <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-cyan-500" /> MIN Note
                      </span>
                    )}
                    {!hasVerifications && (
                      <span className="text-slate-400 italic text-[10px]">Standard State Gate</span>
                    )}
                  </div>

                  {/* Mail Notifications Indicator */}
                  {Array.isArray(gate.rolesToNotify) && gate.rolesToNotify.length > 0 && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      <Mail className="w-3 h-3 text-amber-500" />
                      Notify: {gate.rolesToNotify.join(', ')}
                    </div>
                  )}
                </div>

                {/* Bottom: Horizontal Approval Chain */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Approvals:</span>
                    {(!gate.approvalLevels || gate.approvalLevels.length === 0) ? (
                      <span className="text-amber-600 font-normal text-[11px] italic">Auto-Pass (No Reviewers)</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {gate.approvalLevels.map((lvl, lIdx) => (
                          <React.Fragment key={lvl.id}>
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              L{lvl.level}: {lvl.requiredRole}
                            </span>
                            {lIdx < gate.approvalLevels.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenBuilder(gate)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-0.5"
                  >
                    <Settings2 className="w-3 h-3" /> Config
                  </button>
                </div>

              </div>

              {/* OUTGOING BRANCHES */}
              <div className="w-full max-w-2xl relative flex justify-center -mt-[2px] pb-8 z-0">
                {/* Left Branch (Reject) */}
                <div className="absolute hidden sm:block left-[10%] top-5 w-[40%] h-8 border-t-2 border-l-2 border-rose-300 rounded-tl-xl" />
                <div className="absolute hidden sm:block left-[10%] top-13 -translate-x-1/2 bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap shadow-xs">
                  Revert ➔ {gate.fromStatus}
                </div>
                <div className="absolute hidden sm:flex left-[30%] top-3 -translate-x-1/2 bg-white text-rose-500 border border-rose-200 rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase items-center gap-0.5 z-10">
                  <XCircle className="w-2.5 h-2.5"/> Reject
                </div>

                {/* Right Branch (Escalate) */}
                <div className="absolute hidden sm:block right-[10%] top-5 w-[40%] h-8 border-t-2 border-r-2 border-amber-300 rounded-tr-xl" />
                <div className="absolute hidden sm:block right-[10%] top-13 translate-x-1/2 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap shadow-xs">
                  Auto-Escalate
                </div>
                <div className="absolute hidden sm:flex right-[30%] top-3 translate-x-1/2 bg-white text-amber-500 border border-amber-200 rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase items-center gap-0.5 z-10">
                  <Clock className="w-2.5 h-2.5"/> SLA Timeout
                </div>

                {/* Center Branch (Approve) */}
                <div className="relative w-[2px] h-[80px] bg-emerald-400 z-0 flex flex-col items-center">
                  <div className="absolute top-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-xs z-10 flex items-center gap-1 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3"/> Approve
                  </div>
                  
                  {/* If last node, show final status target */}
                  {index === entityGates.length - 1 && (
                    <div className="absolute -bottom-1 bg-emerald-600 text-white font-mono text-[10px] font-bold px-3 py-1 rounded-md shadow-sm whitespace-nowrap z-10">
                      {gate.toStatus}
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          );
        })}
      </div>
    </div>
  );
}
