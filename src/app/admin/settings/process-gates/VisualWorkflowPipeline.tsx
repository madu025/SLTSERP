'use client';

import React from 'react';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';
import { 
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
  Layers,
  Sparkles
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
  // Filter gates for the selected entity type
  const entityGates = gates
    .filter(g => entityType === 'ALL' || g.entityType === entityType)
    .sort((a, b) => a.fromStatus.localeCompare(b.fromStatus));

  if (entityGates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-inner">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Active Workflow Pipeline</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto mt-1 mb-6">
          There are currently no process gate policies configured for <span className="font-semibold text-slate-700">{entityType === 'ALL' ? 'any module' : entityType}</span>.
        </p>
        <button
          onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-indigo-200 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Create First Gate Step
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            End-to-End Visual Workflow Pipeline
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {entityType === 'ALL' ? 'All Active Module Workflows' : `${entityType.replace('_', ' ')} Lifecycle`}
            <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full border border-indigo-400/30 font-medium">
              {entityGates.length} Gate Steps
            </span>
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Continuous flow-by-flow pipeline. Each step defines the mandatory transition gate, verification rules, and multi-tier approval chain.
          </p>
        </div>
        <button
          onClick={() => onAddNewGate(entityType !== 'ALL' ? entityType : undefined)}
          className="relative z-10 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Add Intermediate Gate
        </button>
      </div>

      {/* Stepper Pipeline Flow */}
      <div className="relative pl-6 sm:pl-10 space-y-8 before:absolute before:left-3 sm:before:left-5 before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-indigo-500 before:via-purple-500 before:to-emerald-500 before:rounded-full">
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
            <div key={gate.id} className="relative group">
              {/* Step Marker Badge */}
              <div className="absolute -left-6 sm:-left-10 top-0 -translate-x-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-white border-2 border-indigo-600 text-indigo-700 font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                {index + 1}
              </div>

              {/* Step Main Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5 sm:p-6 space-y-4">
                
                {/* Top Bar: Gate Label & Status */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-slate-200">
                        {gate.entityType}
                      </span>
                      <h4 className="text-base font-bold text-slate-850 tracking-tight">
                        {gate.label}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        gate.isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${gate.isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {gate.isEnabled ? 'Active Gate' : 'Disabled'}
                    </span>

                    {/* Actions */}
                    <button
                      onClick={() => onOpenBuilder(gate)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1 text-xs font-medium px-2.5"
                      title="Configure Approval Chain"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Approval Chain ({gate.approvalLevels?.length || 0})
                    </button>
                    <button
                      onClick={() => onEditGate(gate)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 text-xs font-medium px-2"
                      title="Edit Gate Rules"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteGate(gate.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                      title="Delete Gate Policy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle: Transition Route Visualization */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="bg-amber-100/90 text-amber-900 border border-amber-300/80 font-mono text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm">
                      {gate.fromStatus}
                    </div>
                    <div className="flex-1 sm:flex-initial flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-indigo-500 animate-pulse" />
                    </div>
                    <div className="bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 font-mono text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm">
                      {gate.toStatus}
                    </div>
                  </div>

                  {/* Required Verifications Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Verifications:
                    </span>
                    {gate.reqPhotoProof && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3 text-blue-500" /> Photo Proof
                      </span>
                    )}
                    {gate.reqGpsLocation && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-indigo-500" /> GPS Location
                      </span>
                    )}
                    {gate.reqSltsPat && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-purple-500" /> SLTS PAT
                      </span>
                    )}
                    {gate.reqOpmcPat && (
                      <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-fuchsia-500" /> OPMC PAT
                      </span>
                    )}
                    {gate.reqDocUpload && (
                      <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <FileText className="w-3 h-3 text-orange-500" /> Doc Upload
                      </span>
                    )}
                    {gate.writeAuditLedger && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Audit Ledger
                      </span>
                    )}
                    {gate.generateIssueNote && (
                      <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-cyan-500" /> MIN Issue Note
                      </span>
                    )}
                    {!hasVerifications && (
                      <span className="text-slate-400 text-xs italic">Standard Gate (No Proof Required)</span>
                    )}
                  </div>
                </div>

                {/* Bottom: Multi-Tier Approval Chain Summary */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Approval Level Chain ({gate.approvalLevels?.length || 0} Tier{gate.approvalLevels?.length === 1 ? '' : 's'}):
                  </div>
                  {(!gate.approvalLevels || gate.approvalLevels.length === 0) ? (
                    <div className="text-xs text-amber-600 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl flex items-center justify-between">
                      <span>No approval levels assigned to this gate. Anyone with role access can proceed.</span>
                      <button
                        onClick={() => onOpenBuilder(gate)}
                        className="text-xs font-bold text-amber-800 underline hover:text-amber-900"
                      >
                        + Configure Chain
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {gate.approvalLevels.map((lvl) => (
                        <div key={lvl.id} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-slate-700">
                            <span>Level {lvl.levelOrder}: {lvl.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {lvl.requiredRoles.map((role) => (
                              <span key={role} className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-indigo-100">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
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
