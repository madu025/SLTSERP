'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  ShieldCheck,
  Camera,
  MapPin,
  FileText,
  FileCheck,
  Users,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { ProcessGatePolicy, ProcessApprovalLevel } from '@prisma/client';

type GatePolicyWithLevels = ProcessGatePolicy & {
  approvalLevels: ProcessApprovalLevel[];
};

interface StepByStepGateWizardProps {
  gate: GatePolicyWithLevels | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StepByStepGateWizard({
  gate,
  onClose,
  onSuccess
}: StepByStepGateWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [domainActions, setDomainActions] = useState<{label: string; value: string; entityType: string; description?: string}[]>([]);
  const [dynamicStatuses, setDynamicStatuses] = useState<Record<string, {label: string; value: string}[]>>({});

  // Fetch registered Domain Actions and Workflow Statuses from API
  useEffect(() => {
    fetch('/api/admin/domain-actions')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDomainActions(data.data);
        }
      })
      .catch(err => console.error('Failed to load domain actions registry', err));

    fetch('/api/admin/workflow-statuses')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDynamicStatuses(data.data);
        }
      })
      .catch(err => console.error('Failed to load workflow statuses', err));
  }, []);

  // Form State for Gate Policy
  const [formData, setFormData] = useState({
    entityType: gate?.entityType || 'MATERIAL_REQUEST',
    fromStatus: gate?.fromStatus || 'DRAFT',
    toStatus: gate?.toStatus || 'PENDING',
    label: gate?.label || '',
    isEnabled: gate ? gate.isEnabled : true,
    reqOpmcPat: gate?.reqOpmcPat || false,
    reqHoPat: gate?.reqHoPat || false,
    reqSltsPat: gate?.reqSltsPat || false,
    reqPhotoProof: gate?.reqPhotoProof || false,
    reqGpsLocation: gate?.reqGpsLocation || false,
    reqDocUpload: gate?.reqDocUpload || false,
    writeAuditLedger: gate ? gate.writeAuditLedger : true,
    generateIssueNote: gate?.generateIssueNote || false,
    domainAction: gate?.domainAction || '',
  });

  // Form State for Approval Levels
  const [levels, setLevels] = useState<Array<{ level: number; requiredRole: string; specificUserId?: string; description?: string }>>(
    gate?.approvalLevels && gate.approvalLevels.length > 0
      ? gate.approvalLevels.map(l => ({
          level: l.level,
          requiredRole: l.requiredRole,
          specificUserId: l.specificUserId || undefined,
          description: l.description || ''
        }))
      : [
          { level: 1, requiredRole: 'OSP_MANAGER', description: 'Level 1 Operational Verification' }
        ]
  );

  const availableStatuses = dynamicStatuses[formData.entityType] || [];

  const handleEntityTypeChange = (type: string) => {
    const newStatuses = dynamicStatuses[type] || [];
    setFormData(gate => ({
      ...gate,
      entityType: type,
      fromStatus: newStatuses[0]?.value || 'DRAFT',
      toStatus: newStatuses[1]?.value || 'COMPLETED',
      domainAction: '', // Reset domain action when module changes
      label: gate?.label || `${type.replace('_', ' ')} Gate`
    }));
  };

  const handleToggle = (name: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Add / Remove Approval Level
  const addApprovalLevel = () => {
    if (levels.length >= 5) {
      toast.error('Maximum 5 approval levels allowed');
      return;
    }
    const nextLevelNum = levels.length + 1;
    const defaultRole = nextLevelNum === 2 ? 'STORES_MANAGER' : nextLevelNum === 3 ? 'FINANCE_MANAGER' : 'ADMIN';
    setLevels(prev => [
      ...prev,
      { level: nextLevelNum, requiredRole: defaultRole, description: `Level ${nextLevelNum} Verification` }
    ]);
  };

  const removeApprovalLevel = (index: number) => {
    if (levels.length <= 1) {
      toast.error('At least 1 approval level is required');
      return;
    }
    const updated = levels.filter((_, i) => i !== index).map((lvl, idx) => ({ ...lvl, level: idx + 1 }));
    setLevels(updated);
  };

  const updateLevelRole = (index: number, role: string) => {
    const updated = [...levels];
    updated[index].requiredRole = role;
    setLevels(updated);
  };

  // Validation (Simple)
  const canProceedFromStep1 = formData.fromStatus !== formData.toStatus && formData.label.trim() !== '';

  const handleNext = () => {
    if (currentStep === 1) {
      if (!canProceedFromStep1) return;
    }
    if (currentStep < 4) setCurrentStep(prev => prev + 1);
  };

  const handleFinish = async () => {
    try {
      setSaving(true);

      // 1. Save or Update Gate Policy
      const url = gate ? `/api/admin/process-gates/${gate.id}` : `/api/admin/process-gates`;
      const method = gate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          label: formData.label || `${formData.entityType} ${formData.fromStatus} -> ${formData.toStatus} Gate`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save gate policy');

      const savedGateId = gate ? gate.id : data.data.id;

      // 2. Save Approval Levels for Gate Policy
      const levelsRes = await fetch(`/api/admin/process-gates/${savedGateId}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levels })
      });

      if (!levelsRes.ok) {
        console.warn('Warning: Level saving returned error, check logs');
      }

      toast.success(gate ? 'Process Gate updated successfully!' : 'New Process Gate activated successfully!');
      onSuccess();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save process gate');
    } finally {
      setSaving(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'මොඩියුලය සහ තත්ත්වය', subLabel: 'Step 1: Module & Transition' },
    { num: 2, label: 'අවශ්‍ය සාක්ෂි', subLabel: 'Step 2: Required Proofs' },
    { num: 3, label: 'අනුමත කරන නිලධාරීන්', subLabel: 'Step 3: Approval Roles' },
    { num: 4, label: 'තහවුරු කිරීම', subLabel: 'Step 4: Review & Activate' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-6">

        {/* Wizard Header Bar */}
        <div className="bg-slate-900 text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  {gate ? 'Process Gate Policy සංස්කරණය (Guided Wizard)' : 'නව Process Gate එකක් සැකසීම (Step-by-Step Wizard)'}
                </h3>
                <p className="text-xs text-slate-400">
                  Beginner Admin Friendly: අදියර 4කින් පහසුවෙන්ම අනුමැති පියවර සකසන්න.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2 mt-6">
            {stepsList.map((st) => (
              <div
                key={st.num}
                onClick={() => { if (st.num < currentStep) setCurrentStep(st.num); }}
                className={`flex flex-col p-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentStep === st.num
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : currentStep > st.num
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Step {st.num}</span>
                  {currentStep > st.num && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-xs font-bold mt-1 truncate">{st.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Body Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[60vh]">

          {/* STEP 1: Module & Status Transition */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  පියවර 1: මොඩියුලය සහ අනුමැතිය සිදුවන තත්ත්වය තෝරන්න
                </h4>
                <p className="text-xs text-indigo-800">
                  කුමන මොඩියුලයේ (Module) කුමන වෙනස්වීමේදීද මෙම අනුමැතිය (Approval Gate) සක්‍රීය විය යුත්තේ?
                </p>
              </div>

              {/* Module Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">1.1 අදාළ Module එක තෝරන්න:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { type: 'MATERIAL_REQUEST', label: 'Material Requests', desc: 'ද්‍රව්‍ය ඉල්ලීම් අනුමැතීන්' },
                    { type: 'SERVICE_ORDER', label: 'Service Orders (SOD)', desc: 'වැඩ නියෝග හා PAT අනුමැතීන්' },
                    { type: 'INVOICE', label: 'Invoices & Billing', desc: 'කොන්ත්‍රාත්කාර බිල්පත් අනුමැතීන්' },
                    { type: 'PROJECT_TASK', label: 'Project Tasks', desc: 'ව්‍යාපෘති කාර්යයන් සහ Field Tasks' },
                    { type: 'STOCK_TRANSFER', label: 'Stock Transfers', desc: 'ගබඩා අතර බඩු මාරු කිරීම්' },
                    { type: 'PURCHASE_ORDER', label: 'Purchase Orders', desc: 'මිලදී ගැනීමේ ඇණවුම් අනුමැතීන්' }
                  ].map((mod) => (
                    <button
                      key={mod.type}
                      type="button"
                      onClick={() => handleEntityTypeChange(mod.type)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        formData.entityType === mod.type
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block">{mod.label}</span>
                      <span className="text-[11px] text-slate-500 mt-1 block leading-tight">{mod.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Transition Selectors */}
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">1.2 ආරම්භක තත්ත්වය (From Status):</label>
                  <select
                    name="fromStatus"
                    value={formData.fromStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, fromStatus: e.target.value }))}
                    className="w-full h-11 text-xs border border-slate-200 rounded-xl px-3 bg-slate-50 font-semibold text-slate-800"
                  >
                    {availableStatuses.map((st: {label: string, value: string}) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 block">අනුමැතිය සඳහා Request එක යොමු වන මොහොතේ පවතින Status එක.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">1.3 අවසාන තත්ත්වය (To Status):</label>
                  <select
                    name="toStatus"
                    value={formData.toStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, toStatus: e.target.value }))}
                    className="w-full h-11 text-xs border border-slate-200 rounded-xl px-3 bg-slate-50 font-semibold text-slate-800"
                  >
                    {availableStatuses.map((st: {label: string, value: string}) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 block">සියලු අනුමැතීන් ලැබුණු පසු Request එක මාරු වන අලුත් Status එක.</span>
                </div>
              </div>

              {/* Domain Action Selector (Zero-Coding Dynamic Registry mapping) */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">1.4 Webhook / Backend Action:</label>
                <select
                  name="domainAction"
                  value={formData.domainAction || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, domainAction: e.target.value }))}
                  className="w-full h-11 text-xs border border-slate-200 rounded-xl px-3 bg-indigo-50/50 font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None (Only update the status)</option>
                  {domainActions
                    .filter(action => action.entityType === formData.entityType)
                    .map((action, idx) => (
                      <option key={idx} value={action.value}>
                        {action.label}
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-slate-500 block">අනුමැතිය අවසන් වූ පසු System එකෙන් ස්වයංක්‍රීයව ක්‍රියාත්මක විය යුතු ක්‍රියාව මෙතැනින් තෝරන්න. (Dynamic Registry)</span>
              </div>

              {/* Validation Warning */}
              {formData.fromStatus === formData.toStatus && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>අවධානයයි: From Status සහ To Status එකම අගයක් විය නොහැක! වෙනස් Status දෙකක් තෝරන්න.</span>
                </div>
              )}

              {/* Policy Label */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">1.5 Gate Policy නම (Friendly Name):</label>
                <input
                  type="text"
                  name="label"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. Material Request Approval Gate"
                  className="w-full h-11 text-xs border border-slate-200 rounded-xl px-3 bg-white font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Proof & Evidence Verifications */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  පියවර 2: අනුමැතියට පෙර අනිවාර්යයෙන් තිබිය යුතු සාක්ෂි තෝරන්න
                </h4>
                <p className="text-xs text-indigo-800">
                  නිලධාරියෙකු අනුමැතිය (Approve) දීමට පෙර පද්ධතිය මගින් අනිවාර්යයෙන් පරීක්ෂා කළ යුතු Verification Checkboxes:
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { key: 'reqPhotoProof', icon: Camera, title: 'Photo Proof Required', desc: 'ක්ලෙම් එකට අදාළ ඡායාරූප අනිවාර්ය වේ.' },
                  { key: 'reqGpsLocation', icon: MapPin, title: 'GPS Location Coordinates', desc: 'ස්ථානයේ GPS Location එක සටහන් විය යුතුය.' },
                  { key: 'reqOpmcPat', icon: FileCheck, title: 'OPMC PAT Acceptance', desc: 'ප්‍රාදේශීය OPMC PAT එක අනුමත වී තිබිය යුතුය.' },
                  { key: 'reqHoPat', icon: FileText, title: 'Head Office PAT Acceptance', desc: 'ප්‍රධාන කාර්යාල HO PAT එක අනුමත වී තිබිය යුතුය.' },
                  { key: 'reqDocUpload', icon: FileText, title: 'Document Upload Proof', desc: 'බිල්පත් හෝ ලේඛන එකතු කර තිබිය යුතුය.' },
                  { key: 'generateIssueNote', icon: FileText, title: 'Generate Issue Note (MIN)', desc: 'අනුමත වූ පසු Material Issue Note අංකයක් හැදේ.' }
                ].map((item) => {
                  const IconComp = item.icon;
                  const isChecked = Boolean(formData[item.key as keyof typeof formData]);
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleToggle(item.key, !isChecked)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{item.title}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 block leading-snug">{item.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Approval Roles & Levels */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  පියවර 3: අනුමත කරන නිලධාරීන් සහ අදියර සකසන්න
                </h4>
                <p className="text-xs text-indigo-800">
                  Level 1, Level 2, Level 3 ලෙස පිළිවෙලින් අනුමැතිය ලබාදිය යුතු නිලධාරීන්ගේ Roles තෝරන්න.
                </p>
              </div>

              {/* SoD Protection Notice */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>🛡️ <strong>Maker-Checker Enforced:</strong> Request එක සෑදූ කෙනාට එය තමන්ටම Approve කිරීමට පද්ධතිය ඉඩ නොදේ.</span>
              </div>

              {/* Levels List */}
              <div className="space-y-3">
                {levels.map((lvl, index) => (
                  <div key={index} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-xs text-indigo-950 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                          {lvl.level}
                        </span>
                        Level {lvl.level} Approver
                      </span>
                      {levels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeApprovalLevel(index)}
                          className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Level
                        </button>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">Required Role:</label>
                        <select
                          value={lvl.requiredRole}
                          onChange={(e) => updateLevelRole(index, e.target.value)}
                          className="w-full h-10 text-xs border border-slate-200 rounded-xl px-3 bg-slate-50 font-semibold text-slate-800"
                        >
                          <option value="OSP_MANAGER">OSP_MANAGER (OSP Manager)</option>
                          <option value="STORES_MANAGER">STORES_MANAGER (Stores Manager)</option>
                          <option value="FINANCE_MANAGER">FINANCE_MANAGER (Finance Manager)</option>
                          <option value="AREA_MANAGER">AREA_MANAGER (Area Manager)</option>
                          <option value="ENGINEER">ENGINEER (Telecom Engineer)</option>
                          <option value="ADMIN">ADMIN (System Administrator)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">Instructions / Description:</label>
                        <input
                          type="text"
                          value={lvl.description || ''}
                          onChange={(e) => {
                            const updated = [...levels];
                            updated[index].description = e.target.value;
                            setLevels(updated);
                          }}
                          placeholder="e.g. Verify field materials"
                          className="w-full h-10 text-xs border border-slate-200 rounded-xl px-3 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Level Button */}
              {levels.length < 5 && (
                <button
                  type="button"
                  onClick={addApprovalLevel}
                  className="w-full py-3 rounded-2xl border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Level {levels.length + 1} Approver
                </button>
              )}
            </div>
          )}

          {/* STEP 4: Review & Activate Summary */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  පියවර 4: තහවුරු කර Gate Policy එක සක්‍රීය කරන්න
                </h4>
                <p className="text-xs text-indigo-800">
                  ඔබ විසින් සාදන ලද Process Gate Configuration එකේ සාරාංශය (Summary):
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">{formData.entityType}</span>
                    <h5 className="font-bold text-base text-white">{formData.label || `${formData.entityType} Gate`}</h5>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
                    Active Gate
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block">Transition Path:</span>
                    <div className="flex items-center gap-2 font-mono font-bold">
                      <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">{formData.fromStatus}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">{formData.toStatus}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 block">Approval Chain:</span>
                    <div className="font-bold text-indigo-300">
                      {levels.length} Level{levels.length !== 1 ? 's' : ''} ({levels.map(l => l.requiredRole).join(' ➔ ')})
                    </div>
                  </div>

                  {formData.domainAction && (
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-slate-400 block">Mapped Webhook Action:</span>
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-900/50 w-fit">
                        <Sparkles className="w-3.5 h-3.5" />
                        {domainActions.find(a => a.value === formData.domainAction)?.label || formData.domainAction}
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence Badges */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Required Verifications:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.reqPhotoProof && <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">📸 Photo Proof</span>}
                    {formData.reqGpsLocation && <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold">📍 GPS Location</span>}
                    {formData.reqOpmcPat && <span className="bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded text-[10px] font-bold">🛡️ OPMC PAT</span>}
                    {formData.generateIssueNote && <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">📑 Issue Note (MIN)</span>}
                    {!formData.reqPhotoProof && !formData.reqGpsLocation && !formData.reqOpmcPat && !formData.generateIssueNote && (
                      <span className="text-slate-500 italic text-[11px]">Standard Gate Verification</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1 || saving}
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> පස්සට (Back)
          </button>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <button
                type="button"
                disabled={(currentStep === 1 && !canProceedFromStep1) || saving}
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-40"
              >
                ඊළඟ පියවර (Next) <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4" />
                {saving ? 'සුරකිමින් පවතී...' : 'තහවුරු කර සක්‍රීය කරන්න (Save & Activate)'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
