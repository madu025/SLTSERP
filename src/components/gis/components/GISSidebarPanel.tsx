import { 
  Sparkles, 
  Ruler, 
  MapPin, 
  X, 
  Loader2, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  Info,
  BrainCircuit
} from 'lucide-react';
import { type AutoPlanResult } from '@/services/GISAutoPlanService';
import { type ComplianceReport, type OSPReasoningStep, type AuditViolation } from '../utils/mapAuditor';

interface OSPLayoutSummary {
  sduCount: number;
  mduCount: number;
  fdpCount: number;
  poleCount: number;
  totalCableLength: number;
}

interface AISuggestion {
  index: number;
  latitude: number;
  longitude: number;
  reason: string;
}

interface GISSidebarPanelProps {
  mapReady: boolean;
  toolMode: 'PLAN' | 'MEASURE';
  setToolMode: (mode: 'PLAN' | 'MEASURE') => void;
  measureActive: boolean;
  toggleMeasure: () => void;
  clearMeasure: () => void;
  totalDistance: number | null;
  lastSegmentDistance: number | null;
  autoPlanData: AutoPlanResult | null;
  autoPlanLoading: boolean;
  feedPointSelectActive: boolean;
  setFeedPointSelectActive: (val: boolean | ((prev: boolean) => boolean)) => void;
  feedPointCoord: [number, number] | null;
  setFeedPointCoord: (coord: [number, number] | null) => void;
  splitterRatio: string;
  setSplitterRatio: (ratio: string) => void;
  toggleAutoPlan: () => void;
  autoPlanActive: boolean;
  clearAutoPlan: () => void;
  autoPlanSummary: OSPLayoutSummary | null;
  runAiLayoutAudit: () => void;
  aiAuditLoading: boolean;
  aiAuditWarnings: string[] | null;
  aiSuggestions: AISuggestion[] | null;
  applyAiCorrections: () => void;
  routeName: string;
  setRouteName: (name: string) => void;
  savingPlan: boolean;
  handleSavePlan: () => void;
  mapRef: React.RefObject<import('ol/Map').default | null>;
  autoPlanDrawRef: React.RefObject<import('ol/interaction/Draw').default | null>;
  setAutoPlanActive: (active: boolean) => void;
  complianceReport?: ComplianceReport;
  ospReasoning?: OSPReasoningStep[];
}

export function GISSidebarPanel({
  mapReady,
  toolMode,
  setToolMode,
  measureActive,
  toggleMeasure,
  clearMeasure,
  totalDistance,
  lastSegmentDistance,
  autoPlanData,
  autoPlanLoading,
  feedPointSelectActive,
  setFeedPointSelectActive,
  feedPointCoord,
  setFeedPointCoord,
  splitterRatio,
  setSplitterRatio,
  toggleAutoPlan,
  autoPlanActive,
  clearAutoPlan,
  autoPlanSummary,
  runAiLayoutAudit,
  aiAuditLoading,
  aiAuditWarnings,
  aiSuggestions,
  applyAiCorrections,
  routeName,
  setRouteName,
  savingPlan,
  handleSavePlan,
  mapRef,
  autoPlanDrawRef,
  setAutoPlanActive,
  complianceReport,
  ospReasoning,
}: GISSidebarPanelProps) {
  if (!mapReady) return null;

  return (
    <div className="absolute top-4 right-6 z-[1000] bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-700/50 p-4 min-w-[260px] max-w-[300px] text-white select-none transition-all duration-300">
      <div>
        {/* Segmented Mode Switcher */}
        <div className="flex bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/30 mb-4">
          <button
            type="button"
            onClick={() => {
              setToolMode('PLAN');
              if (measureActive) clearMeasure();
            }}
            className={`flex-1 text-[10px] font-extrabold uppercase py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              toolMode === 'PLAN'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-900/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Plan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setToolMode('MEASURE');
              setAutoPlanActive(false);
              const map = mapRef.current;
              if (map && autoPlanDrawRef.current) {
                map.removeInteraction(autoPlanDrawRef.current);
              }
            }}
            className={`flex-1 text-[10px] font-extrabold uppercase py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              toolMode === 'MEASURE'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-900/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Measure</span>
          </button>
        </div>

        {/* ─── Mode 1: Distance Measurement Tool ─────────────────────────────────── */}
        {toolMode === 'MEASURE' && (
          <div className="space-y-3.5">
            <button
              type="button"
              onClick={toggleMeasure}
              className={`w-full text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                measureActive
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700/50'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>{measureActive ? 'Measuring Active...' : 'Start Distance Measure'}</span>
            </button>
            
            {measureActive && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 leading-normal flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Click points on the map. Double-click to complete measurement.</span>
              </div>
            )}

            {totalDistance !== null && !measureActive && (
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-3.5 space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Measurement Result</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-xs">Total Length:</span>
                  <strong className="text-amber-400 text-sm font-mono">{totalDistance.toFixed(2)} m</strong>
                </div>
                {lastSegmentDistance !== null && (
                  <div className="flex justify-between items-baseline text-[10px] border-t border-slate-700/50 pt-1.5 mt-1.5">
                    <span className="text-slate-500">Last Segment:</span>
                    <span className="text-slate-300 font-mono">{lastSegmentDistance.toFixed(2)} m</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Mode 2: AI Auto-Planner Tool ────────────────────────────────────────── */}
        {toolMode === 'PLAN' && (
          <div className="space-y-4">
            {!autoPlanData ? (
              /* STEP 1: Setup configuration options */
              <div className="space-y-4">
                {/* Origin Selection */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Feeder Origin (Base Point):</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFeedPointSelectActive(prev => !prev)}
                      disabled={autoPlanLoading}
                      type="button"
                      className={`flex-1 text-[11px] font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        feedPointSelectActive
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 animate-pulse'
                          : feedPointCoord
                          ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
                      }`}
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        {feedPointSelectActive 
                          ? 'Click on Map...' 
                          : feedPointCoord 
                          ? `Origin Set (${feedPointCoord[1].toFixed(4)}, ${feedPointCoord[0].toFixed(4)})` 
                          : 'Set Origin Base Point'}
                      </span>
                    </button>
                    {feedPointCoord && (
                      <button
                        onClick={() => {
                          setFeedPointCoord(null);
                          setFeedPointSelectActive(false);
                        }}
                        type="button"
                        className="p-2 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 hover:bg-red-900/50 active:scale-95 transition-all flex items-center justify-center"
                        title="Clear Origin"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Capacity Ratio */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Splitter Ratio Limit:</label>
                  <select
                    value={splitterRatio}
                    onChange={(e) => setSplitterRatio(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    disabled={autoPlanLoading}
                  >
                    <option value="1:8">1:8 Split (Max 8 Homes/FDP)</option>
                    <option value="1:16">1:16 Split (Max 16 Homes/FDP)</option>
                    <option value="1:4">1:4 Split (Max 4 Homes/FDP)</option>
                  </select>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    onClick={toggleAutoPlan}
                    disabled={autoPlanLoading}
                    className={`w-full text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                      autoPlanActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-pulse'
                        : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/25 active:scale-[0.98]'
                    }`}
                  >
                    {autoPlanLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Querying Map Data...</span>
                      </>
                    ) : autoPlanActive ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>✍️ Drawing Area on Map...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Draw & Generate Plan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: Review and Save options */
              <div className="space-y-3.5">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      📊 Layout Summary
                    </span>
                    <button
                      onClick={clearAutoPlan}
                      className="text-[9px] font-bold text-red-400 hover:text-red-300 flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>
                  </div>
                  
                  {autoPlanSummary && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 block">Homes SDU:</span>
                        <strong className="text-slate-200 font-semibold">{autoPlanSummary.sduCount}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 block">MDUs / Schools:</span>
                        <strong className="text-slate-200 font-semibold">{autoPlanSummary.mduCount}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 block">FDPs (1:8):</span>
                        <strong className="text-slate-200 font-semibold">{autoPlanSummary.fdpCount}</strong>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 block">New Poles:</span>
                        <strong className="text-slate-200 font-semibold">{autoPlanSummary.poleCount}</strong>
                      </div>
                      <div className="col-span-2 space-y-0.5 border-t border-slate-700/50 pt-2 flex justify-between items-baseline">
                        <span className="text-[10px] text-slate-400">Total Cable:</span>
                        <strong className="text-orange-400 text-sm font-mono">{autoPlanSummary.totalCableLength.toFixed(0)} m</strong>
                      </div>
                    </div>
                  )}

                  {complianceReport && autoPlanData && (
                    <div className="bg-slate-850/80 border border-slate-700/50 rounded-2xl p-3 space-y-2 mt-3 shadow-inner">
                      <div className="flex items-center gap-3 bg-slate-800/40 p-2 rounded-xl border border-slate-700/30">
                        {/* Radial Progress Ring SVG */}
                        <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle
                              className="text-slate-700"
                              strokeWidth="3"
                              stroke="currentColor"
                              fill="transparent"
                              r="16"
                              cx="18"
                              cy="18"
                            />
                            <circle
                              className={`transition-all duration-700 ease-out ${
                                complianceReport.score >= 90 ? 'text-emerald-500' :
                                complianceReport.score >= 70 ? 'text-amber-500' :
                                'text-rose-500'
                              }`}
                              strokeWidth="3.5"
                              strokeDasharray="100"
                              strokeDashoffset={100 - complianceReport.score}
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="16"
                              cx="18"
                              cy="18"
                            />
                          </svg>
                          <span className="absolute text-[9px] font-black tracking-tighter text-slate-100">
                            {complianceReport.score}%
                          </span>
                        </div>

                        {/* Title and Summary */}
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Design Compliance:</span>
                          <span className={`text-[10px] font-extrabold block truncate ${
                            complianceReport.score >= 90 ? 'text-emerald-400' :
                            complianceReport.score >= 70 ? 'text-amber-400' :
                            'text-rose-400'
                          }`}>
                            {complianceReport.score >= 90 ? '✅ Compliant Layout' :
                             complianceReport.score >= 70 ? '⚠ Corrections Needed' :
                             '🚨 Violations Found'}
                          </span>
                        </div>
                      </div>

                      {complianceReport.violations.length > 0 ? (
                        <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 text-[8px] leading-normal pt-1 border-t border-slate-800/50">
                          {complianceReport.violations.map((v: AuditViolation, i: number) => (
                            <div key={i} className="flex items-start gap-1 text-slate-300">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                v.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                              }`} />
                              <span>{v.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[8px] text-emerald-400 pt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                          <span>100% Engineering Compliance. No violations.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {ospReasoning && ospReasoning.length > 0 && (
                    <div className="bg-slate-850/80 border border-slate-700/50 rounded-2xl p-3 space-y-2 mt-3 shadow-inner">
                      <div className="flex items-center gap-1.5 border-b border-slate-800/50 pb-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">AI Planner Decisions:</span>
                      </div>
                      
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {ospReasoning.map((step: OSPReasoningStep, i: number) => (
                          <div key={i} className="space-y-0.5 text-[8px] leading-normal border-b border-slate-800/30 pb-1.5 last:border-b-0 last:pb-0">
                            <span className="font-extrabold text-slate-200 block">{step.title}</span>
                            <span className="text-slate-400 block">{step.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Optimization section */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={runAiLayoutAudit}
                    disabled={aiAuditLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-2"
                  >
                    {aiAuditLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Running AI Audit...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Optimize & Heal Layout</span>
                      </>
                    )}
                  </button>

                  {aiAuditWarnings && (
                    <div className="p-2.5 bg-indigo-950/50 border border-indigo-500/30 rounded-xl space-y-1.5 text-[9px] max-h-36 overflow-y-auto">
                      <p className="font-extrabold text-indigo-400 uppercase tracking-wider text-[8px] flex items-center gap-1">
                        🤖 AI Auditor Insights:
                      </p>
                      {aiAuditWarnings.map((warn, i) => (
                        <div key={i} className="text-slate-300 border-b border-indigo-500/10 pb-1.5 last:border-b-0 last:pb-0 leading-normal flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                          <span>{warn}</span>
                        </div>
                      ))}

                      {aiSuggestions && aiSuggestions.length > 0 && (
                        <button
                          type="button"
                          onClick={applyAiCorrections}
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all active:scale-[0.97]"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Apply AI Corrections ({aiSuggestions.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Save layout form */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-3.5 space-y-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Save Route Plan:</label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-700 rounded-xl bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Route Plan Name..."
                    disabled={savingPlan}
                  />
                  <button
                    onClick={handleSavePlan}
                    disabled={savingPlan}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    {savingPlan ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Layout...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Layout Plan</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Premium Drag & Drop tip */}
                <div className="text-[9px] text-slate-400 font-medium leading-normal mt-3 border-t border-slate-700/50 pt-2 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>Drag & Drop FDPs/Poles on the map to manually adjust layout before saving.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
