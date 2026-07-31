'use client';

import React from 'react';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';
import { 
  ArrowDown,
  ShieldCheck, 
  Camera, 
  MapPin, 
  FileCheck, 
  FileText, 
  Receipt, 
  Settings2, 
  Plus, 
  Trash2,
  Layers,
  Sparkles,
  XCircle,
  Clock,
  GitBranch
} from 'lucide-react';

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
}

export function VisualWorkflowPipeline({
  entityType,
  gates,
  onEditGate,
  onOpenBuilder,
  onDeleteGate,
  onAddNewGate,
}: VisualWorkflowPipelineProps) {
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

  if (entityGates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-inner">
          <GitBranch className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Active Decision Tree</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto mt-1 mb-6">
          There are currently no process gate nodes configured for <span className="font-semibold text-slate-700">{entityType === 'ALL' ? 'any module' : entityType}</span>.
        </p>
        <button
          onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-200 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Create First Decision Node
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            Decision Tree Flow Graph
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {entityType === 'ALL' ? 'All Active Module Trees' : `${entityType.replace('_', ' ')} Lifecycle`}
            <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full border border-indigo-400/30 font-medium flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" />
              {entityGates.length} Nodes
            </span>
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Each node acts as a gateway branching into Approval, Rejection, and Escalation paths. Multi-tier validations run inside each node.
          </p>
        </div>
        <button
          onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
          className="relative z-10 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Add Tree Node
        </button>
      </div>

      {/* Tree Visualization Canvas */}
      <div className="relative w-full flex flex-col items-center pt-8">
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
                <div className="w-[2px] h-8 bg-slate-300 relative flex justify-center z-0">
                  <div className="absolute top-1/2 -translate-y-1/2 bg-slate-100 rounded-full border border-slate-300 p-0.5">
                    <ArrowDown className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Main Node Card */}
              <div className="w-full max-w-3xl bg-white border-2 border-indigo-200 shadow-xl shadow-indigo-900/5 rounded-2xl relative z-10 hover:border-indigo-400 transition-colors p-5 sm:p-6">
                
                {/* Entry Point Status (From) */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-100 text-indigo-900 border border-indigo-300 px-4 py-1 rounded-full text-xs font-bold font-mono shadow-sm">
                  {gate.fromStatus}
                </div>

                {/* Top Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <button onClick={() => onEditGate(gate)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDeleteGate(gate.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Gate Header */}
                <div className="mt-2 text-center space-y-1.5 px-10">
                  <span className="inline-block bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-slate-200">
                    {gate.entityType} NODE
                  </span>
                  <h4 className="text-xl font-extrabold text-slate-800 tracking-tight">
                    {gate.label}
                  </h4>
                  {!gate.isEnabled && (
                    <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      DISABLED
                    </span>
                  )}
                </div>

                {/* Verifications (The "Gate" check) */}
                <div className="mt-5 bg-slate-50/80 border border-slate-200/60 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" /> Mandatory Pre-Checks
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {gate.reqPhotoProof && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-blue-500" /> Photo Proof
                      </span>
                    )}
                    {gate.reqGpsLocation && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" /> GPS Location
                      </span>
                    )}
                    {gate.reqSltsPat && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 text-purple-500" /> SLTS PAT
                      </span>
                    )}
                    {gate.reqOpmcPat && (
                      <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 text-fuchsia-500" /> OPMC PAT
                      </span>
                    )}
                    {gate.reqDocUpload && (
                      <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-orange-500" /> Doc Upload
                      </span>
                    )}
                    {gate.writeAuditLedger && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Audit Ledger
                      </span>
                    )}
                    {gate.generateIssueNote && (
                      <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-cyan-500" /> MIN Issue Note
                      </span>
                    )}
                    {!hasVerifications && (
                      <span className="text-slate-400 text-xs italic">Standard state transition only.</span>
                    )}
                  </div>
                </div>

                {/* Approval Chain (The Reviewers) */}
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Approval Chain ({gate.approvalLevels?.length || 0})
                    </div>
                    <button 
                      onClick={() => onOpenBuilder(gate)} 
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-100 transition-colors flex items-center gap-1"
                    >
                      <Settings2 className="w-3 h-3" /> Configure Chain
                    </button>
                  </div>
                  
                  {(!gate.approvalLevels || gate.approvalLevels.length === 0) ? (
                    <div className="text-[11px] text-amber-600 bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl">
                      Automated Node: No manual approvals required. System will automatically evaluate verifications.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {gate.approvalLevels.map((lvl) => (
                        <div key={lvl.id} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between font-bold text-slate-700 text-[11px]">
                            <span>Lvl {lvl.level}: {lvl.description || 'Approver'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {lvl.requiredRole && (
                              <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-indigo-100">
                                {lvl.requiredRole}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* OUTGOING BRANCHES */}
              <div className="w-full max-w-3xl relative flex justify-center -mt-[2px] pb-10 z-0">
                {/* Left Branch (Reject) */}
                <div className="absolute hidden sm:block left-[12%] top-6 w-[38%] h-10 border-t-2 border-l-2 border-rose-300 rounded-tl-xl" />
                <div className="absolute hidden sm:block left-[12%] top-16 -translate-x-1/2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shadow-sm">
                  Revert ➔ {gate.fromStatus}
                </div>
                <div className="absolute hidden sm:flex left-[31%] top-4 -translate-x-1/2 bg-white text-rose-500 border border-rose-200 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase items-center gap-1 z-10">
                  <XCircle className="w-3 h-3"/> Reject
                </div>

                {/* Right Branch (Escalate) */}
                <div className="absolute hidden sm:block right-[12%] top-6 w-[38%] h-10 border-t-2 border-r-2 border-amber-300 rounded-tr-xl" />
                <div className="absolute hidden sm:block right-[12%] top-16 translate-x-1/2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shadow-sm">
                  Auto-Escalate
                </div>
                <div className="absolute hidden sm:flex right-[31%] top-4 translate-x-1/2 bg-white text-amber-500 border border-amber-200 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase items-center gap-1 z-10">
                  <Clock className="w-3 h-3"/> SLA Timeout
                </div>

                {/* Center Branch (Approve) */}
                <div className="relative w-[2px] h-[96px] bg-emerald-400 z-0 flex flex-col items-center">
                  <div className="absolute top-8 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm z-10 flex items-center gap-1 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3"/> Approve
                  </div>
                  
                  {/* If last node, show final status target */}
                  {index === entityGates.length - 1 && (
                    <div className="absolute -bottom-2 bg-emerald-600 text-white font-mono text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-md whitespace-nowrap z-10">
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
