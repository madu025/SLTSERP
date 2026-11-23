"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, User, ChevronLeft, ChevronRight, Check, Sparkles, Building2, Store as StoreIcon, BadgeCheck } from "lucide-react";
import { ROLE_CATEGORIES, isContractorRole } from '@/config/roles';
import {
  USER_STATUSES, USER_STATUS_LABELS, OPMC_REQUIRED_ROLES, PASSWORD_RULE_TEXT, generateTemporaryPassword, normalizeUserStatus, passwordProblem,
  roleNeedsOpmc, roleNeedsStoreOrOpmc,
} from '@/config/user-admin';

// Zod Schema (the server repeats these rules; this is for an early, readable message)
const userSchema = z.object({
  username: z.string().trim().min(3, "Username required (min 3 chars)"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().optional(),
  name: z.string().trim().min(2, "Full name required"),
  role: z.string().min(1, "Role selection is required"),
  employeeId: z.string().optional(),
  opmcIds: z.array(z.string()),
  supervisorId: z.string().optional(),
  assignedStoreId: z.string().optional(),
  status: z.enum(USER_STATUSES).optional(),
}).superRefine((data, ctx) => {
  if (data.password && data.password.length > 0) {
    const problem = passwordProblem(data.password);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ["password"] });
  }
});

export type UserFormValues = z.infer<typeof userSchema>;

export interface UserProp {
  id?: string;
  name?: string | null;
  username?: string;
  role: string;
  accessibleOpmcs?: { id: string }[];
  contractorId?: string | null;
  employeeId?: string | null;
}

export interface OpmcProp {
  id: string;
  name: string;
  rtom?: string;
  storeId?: string | null;
}

export interface StoreProp {
  id: string;
  name: string;
}

interface DesignationOption { section: { id: string; code: string; name: string }; roles: Array<{ id: string; code: string; name: string; forRole: string | null }> }
interface FormOptions { scopeAll?: Record<string, string[]>; roles: string[]; baseAvailable: string[]; designations: DesignationOption[]; opmcRequiredRoles: string[]; categories: Record<string, string[]> }

export type DesignationPick = { sectionId: string; roleId: string; isPrimary: boolean };

interface UserFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UserFormValues & { designations?: DesignationPick[] }) => void;
  initialData?: Omit<UserFormValues, 'status'> & {
    id?: string;
    status?: string;
    hasCustomGrants?: boolean;
    supervisor?: { id: string; name: string | null; username: string };
    sectionAssignments?: Array<{
      id: string;
      section: { id: string; name: string };
      role: { id: string; name: string };
      isPrimary: boolean;
    }>;
  };
  isSubmitting: boolean;
  opmcs: OpmcProp[];
  stores: StoreProp[];
}

const EMPTY: UserFormValues = {
  username: '', email: '', password: '', name: '', role: '', employeeId: '',
  opmcIds: [], supervisorId: '', assignedStoreId: 'none', status: 'active',
};

export function UserFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
  opmcs,
  stores
}: UserFormDrawerProps) {
  const [step, setStep] = useState(1);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [designationPicks, setDesignationPicks] = useState<Record<string, string>>({});
  const [primarySection, setPrimarySection] = useState<string | null>(null);
  const [designationsTouched, setDesignationsTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = Boolean(initialData?.id);

  const form = useForm<UserFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userSchema) as any,
    defaultValues: EMPTY,
  });

  const watchedOpmcIds = useWatch({ control: form.control, name: 'opmcIds' });
  const watchedRole = useWatch({ control: form.control, name: 'role' });
  const watchedStore = useWatch({ control: form.control, name: 'assignedStoreId' });

  // Roles come from the live database enum; baseAvailable lists the ones that really have a SystemRole (a user without one has no permissions)
  const { data: options } = useQuery<FormOptions>({
    queryKey: ['user-form-options'],
    queryFn: async () => {
      const res = await fetch('/api/admin/role-options');
      if (!res.ok) throw new Error('Failed to load role options');
      return res.json();
    },
    staleTime: 60 * 1000,
    // placeholder, not initialData: initialData counts as fresh and the real options would never be fetched
    placeholderData: { roles: Object.values(ROLE_CATEGORIES).flat(), baseAvailable: Object.values(ROLE_CATEGORIES).flat(), designations: [], opmcRequiredRoles: [...OPMC_REQUIRED_ROLES], categories: ROLE_CATEGORIES },
  });
  const baseAvailable = useMemo(() => new Set(options?.baseAvailable ?? []), [options]);
  const needsOpmc = (role: string) => roleNeedsOpmc(role) || (options?.opmcRequiredRoles ?? []).includes(role);

  // Group enum roles by category; unmapped roles land in "Other" so new enum values never vanish from the UI
  const roleCategories = useMemo<Record<string, string[]>>(() => {
    // contractor users are created from the contractor registration; only an existing contractor user keeps its role in the list
    const roles = (options?.roles || Object.values(ROLE_CATEGORIES).flat()).filter((r) => !isContractorRole(r) || r === initialData?.role);
    const categories = options?.categories || ROLE_CATEGORIES;
    const grouped: Record<string, string[]> = {};
    const mapped = new Set<string>();
    for (const [cat, catRoles] of Object.entries(categories)) {
      const present = catRoles.filter((r) => roles.includes(r));
      if (present.length) grouped[cat] = present;
      present.forEach((r) => mapped.add(r));
    }
    const other = roles.filter((r) => !mapped.has(r));
    if (other.length) grouped['Other'] = other;
    return Object.keys(grouped).length > 0 ? grouped : ROLE_CATEGORIES;
  }, [options, initialData?.role]);

  // Sync form and section when drawer opens/closes
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setShowPassword(false);
      setDesignationsTouched(false);
      if (initialData) {
        form.reset({
          username: initialData.username, email: initialData.email, name: initialData.name,
          role: initialData.role, employeeId: initialData.employeeId || '',
          password: '', // a blank password keeps the current one
          assignedStoreId: initialData.assignedStoreId || 'none',
          supervisorId: initialData.supervisorId || '',
          opmcIds: initialData.opmcIds || [],
          status: (USER_STATUSES as readonly string[]).includes(normalizeUserStatus(initialData.status)) ? (normalizeUserStatus(initialData.status) as UserFormValues['status']) : 'active',
        });
        const section = Object.entries(roleCategories).find(([, roles]) => roles.includes(initialData.role))?.[0] || null;
        setSelectedSection(section);
        const picks: Record<string, string> = {};
        for (const a of initialData.sectionAssignments ?? []) picks[a.section.id] = a.role.id;
        setDesignationPicks(picks);
        setPrimarySection(initialData.sectionAssignments?.find((a) => a.isPrimary)?.section.id ?? null);
      } else {
        form.reset(EMPTY);
        setSelectedSection(null);
        setDesignationPicks({});
        setPrimarySection(null);
      }
      setStep(1);
    }, 0);
    return () => clearTimeout(timer);
    // roleCategories in deps: re-resolve section for edit mode once async role options load
  }, [open, initialData, form, roleCategories]);

  const handleSelectAllOpmcs = (checked: boolean) => {
    form.setValue('opmcIds', checked ? opmcs.map(o => o.id) : [], { shouldDirty: true });
    form.clearErrors('opmcIds');
  };

  // Supervisors are looked up on the server as the administrator types (the user list is paged, so it cannot be filtered here)
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [supervisorQuery, setSupervisorQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSupervisorQuery(supervisorSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [supervisorSearch]);
  const { data: supervisorData } = useQuery<{ users: Array<UserProp> }>({
    queryKey: ['supervisor-search', supervisorQuery],
    enabled: open && step === 2,
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '30', status: 'active' });
      if (supervisorQuery) qs.set('search', supervisorQuery);
      const res = await fetch(`/api/users?${qs.toString()}`);
      if (!res.ok) return { users: [] };
      return res.json();
    },
  });
  const filteredSupervisors = useMemo(() => {
    const list = (supervisorData?.users ?? []).filter((u) => u.id !== initialData?.id && !u.contractorId && !(u.role && u.role.startsWith('CONTRACTOR')));
    const current = initialData?.supervisor;
    if (current && !list.some((u) => u.id === current.id)) list.unshift({ id: current.id, name: current.name, username: current.username, role: '' });
    return list;
  }, [supervisorData, initialData]);

  const handleFormSubmit = (data: UserFormValues) => {
    // the same checks the server makes, so the message shows next to the field
    if (!isEdit && !data.password) {
      form.setError('password', { message: 'A password is required for a new user' });
      setStep(1);
      return;
    }
    const hasStore = !!data.assignedStoreId && data.assignedStoreId !== 'none';
    if (needsOpmc(data.role) && data.opmcIds.length === 0) {
      form.setError('opmcIds', { message: `Select at least one OPMC / RTOM for ${data.role.replace(/_/g, ' ')}. Without a region this user would see no orders.` });
      setStep(3);
      return;
    }
    if (roleNeedsStoreOrOpmc(data.role) && data.opmcIds.length === 0 && !hasStore) {
      form.setError('assignedStoreId', { message: 'Select the store this person works in, or at least one OPMC / RTOM.' });
      setStep(3);
      return;
    }
    const designations: DesignationPick[] | undefined = designationsTouched
      ? Object.entries(designationPicks).filter(([, roleId]) => !!roleId).map(([sectionId, roleId], i) => ({ sectionId, roleId, isPrimary: primarySection ? sectionId === primarySection : i === 0 }))
      : undefined;
    onSubmit({
      ...data,
      assignedStoreId: data.assignedStoreId === 'none' ? undefined : data.assignedStoreId,
      supervisorId: !data.supervisorId || data.supervisorId === 'none' ? undefined : data.supervisorId,
      designations,
    });
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (step === 1) {
      let isValid = await form.trigger(['username', 'email', 'name', 'password']);
      if (isValid && !isEdit && !form.getValues('password')) {
        form.setError('password', { message: 'A password is required for a new user' });
        isValid = false;
      }
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await form.trigger(['role']);
      if (isValid) setStep(3);
    }
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStep(prev => Math.max(prev - 1, 1));
  };

  const stepsList = [
    { num: 1, label: '1. Personal & Auth', desc: 'Credentials & Identity' },
    { num: 2, label: '2. Role & Hierarchy', desc: 'Department & Supervisor' },
    { num: 3, label: '3. Store & Access', desc: 'Inventory & RTOM Scopes' }
  ];

  const pickDesignation = (sectionId: string, roleId: string) => {
    setDesignationsTouched(true);
    setDesignationPicks((prev) => {
      const next = { ...prev };
      if (roleId) next[sectionId] = roleId; else delete next[sectionId];
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-slate-50 border-l border-slate-200 overflow-hidden">

        {/* Header */}
        <SheetHeader className="bg-slate-900 text-white p-6 pb-5 flex-none relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                {isEdit ? 'Edit User Details' : 'Create New System User'}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-300">
                {isEdit ? `Updating credentials & permissions for ${initialData?.name || initialData?.username}` : 'Configure credentials, organizational roles, and warehouse access scopes.'}
              </SheetDescription>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-700">
            {stepsList.map((st) => (
              <button
                key={st.num}
                type="button"
                onClick={() => setStep(st.num)}
                className={`flex flex-col text-left p-2 rounded-xl transition-all border ${
                  step === st.num
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : step > st.num
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Step {st.num}</span>
                  {step > st.num && <Check className="w-3 h-3 text-emerald-300" />}
                </div>
                <span className="text-xs font-bold truncate mt-0.5">{st.label.split('. ')[1]}</span>
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Body Content */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-6">

              {/* STEP 1: Personal Details & Security */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-blue-700 flex-shrink-0" />
                    <p className="text-xs text-blue-950 leading-relaxed font-medium">
                      Enter staff identity details and login credentials. The person signs in with the username and must choose their own password at the first sign-in.
                    </p>
                  </div>

                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kasun Sanjeewa" className="h-10 text-sm bg-white text-slate-900 placeholder:text-slate-500" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Username</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 433 or kasun" className="h-10 text-sm bg-white text-slate-900 placeholder:text-slate-500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Employee / Staff ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. EMP-1049" className="h-10 text-sm bg-white text-slate-900 placeholder:text-slate-500" {...field} value={field.value || ''} />
                        </FormControl>
                        <p className="text-[10px] text-slate-600">Needed for the Forgot Password check.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="sanjeewa@slts.lk" className="h-10 text-sm bg-white text-slate-900 placeholder:text-slate-500" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Account Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'active'}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm bg-white text-slate-900">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {USER_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{USER_STATUS_LABELS[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-700">
                        {isEdit ? 'New temporary password (leave blank to keep the current one)' : 'Temporary password'}
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" className="h-10 text-sm bg-white text-slate-900 placeholder:text-slate-500" {...field} value={field.value || ''} />
                        </FormControl>
                        <Button type="button" variant="outline" className="h-10 text-xs font-bold border-slate-300 text-slate-800" onClick={() => { form.setValue('password', generateTemporaryPassword(), { shouldDirty: true, shouldValidate: true }); setShowPassword(true); }}>
                          Generate
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-600">{PASSWORD_RULE_TEXT} Give it to the person yourself; it is not emailed. They must change it at the first sign-in.</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {/* STEP 2: Role & Department */}
              {step === 2 && (() => {
                const currentSection = selectedSection || (watchedRole ? Object.entries(roleCategories).find(([, roles]) => roles.includes(watchedRole))?.[0] || null : null);
                return (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl flex items-center gap-3">
                      <Shield className="w-4 h-4 text-indigo-700 flex-shrink-0" />
                      <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                        The system role gives the base permissions. Module designations (below) add the module-specific level, for example Projects Engineer. Region and store limits are set in the next step.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-700">1. Department / Division</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          setSelectedSection(val);
                          form.setValue('role', '');
                        }}
                        value={currentSection || ''}
                      >
                        <SelectTrigger className="h-11 text-sm bg-white font-semibold text-slate-900">
                          <SelectValue placeholder="-- Select Department --" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(roleCategories).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">2. System Role</FormLabel>
                        <FormControl>
                          <Select
                            disabled={!currentSection}
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="h-11 text-sm bg-white font-bold text-indigo-900 border-indigo-300">
                              <SelectValue placeholder={currentSection ? "-- Select System Role --" : "First select a department above..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {currentSection && roleCategories[currentSection]?.map((role: string) => {
                                const defined = baseAvailable.has(role);
                                return (
                                  <SelectItem key={role} value={role} disabled={!defined} className="font-medium">
                                    {role.replace(/_/g, ' ')}{defined ? '' : ' (no system role defined)'}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Module designations: the module-specific levels (UserSectionAssignment) */}
                    {(options?.designations.length ?? 0) > 0 && (
                      <div className="space-y-2 pt-1">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">3. Module designations (optional)</FormLabel>
                        <p className="text-[11px] text-slate-600">
                          {isEdit
                            ? 'Change these only to give or take away a module level. Left alone, they stay as they are.'
                            : 'Leave empty to add the usual designation for the chosen role automatically.'}
                          {' '}Only designations that fit the chosen role are listed.
                          {isEdit && watchedRole && initialData && watchedRole !== initialData.role && !designationsTouched && (
                            <strong className="block mt-1 text-amber-900">The role is changing: only the old role&apos;s usual designation is swapped for the new one. Every other designation below stays.</strong>
                          )}
                        </p>
                        <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-3">
                          {options!.designations.map((d) => ({ ...d, roles: d.roles.filter((r) => !r.forRole || r.forRole === watchedRole) })).filter((d) => d.roles.length > 0).map((d) => (
                            <div key={d.section.id} className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-800 w-40 truncate" title={d.section.name}>{d.section.name}</span>
                              <select
                                aria-label={`Designation in ${d.section.name}`}
                                value={designationPicks[d.section.id] ?? ''}
                                onChange={(e) => pickDesignation(d.section.id, e.target.value)}
                                className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900"
                              >
                                <option value="">None</option>
                                {d.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <FormField control={form.control} name="supervisorId" render={({ field }) => (
                      <FormItem className="space-y-2 pt-2">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700">Reporting Supervisor (Optional)</FormLabel>
                        <div className="space-y-1.5">
                          <Input
                            type="text"
                            placeholder="Type to search supervisor (name, username, employee ID)..."
                            value={supervisorSearch}
                            onChange={(e) => setSupervisorSearch(e.target.value)}
                            className="h-9 text-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
                          />
                          <Select onValueChange={field.onChange} value={field.value || 'none'}>
                            <FormControl>
                              <SelectTrigger className="h-10 text-sm bg-white font-semibold text-slate-900">
                                <SelectValue placeholder="-- Select Supervisor --" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-60">
                              <SelectItem value="none" className="text-slate-600 italic">None (Independent Officer)</SelectItem>
                              {filteredSupervisors.map(u => (
                                <SelectItem key={u.id} value={u.id!}>
                                  {u.name || u.username} {u.employeeId ? `(#${u.employeeId})` : ''}{u.role ? ` • [${u.role.replace(/_/g, ' ')}]` : ''}
                                </SelectItem>
                              ))}
                              {filteredSupervisors.length === 0 && (
                                <div className="p-2 text-xs text-slate-600 italic text-center">No internal supervisors found</div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {watchedRole && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                        <BadgeCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        <span>Configured Role: <strong>{watchedRole.replace(/_/g, ' ')}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* STEP 3: Store & OPMC Scopes */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center gap-3">
                    <StoreIcon className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <p className="text-xs text-amber-950 leading-relaxed font-medium">
                      Assign warehouse stores and regional RTOM scopes. A permission never gives access to every region: the user sees and changes only the orders of the regions selected here.
                    </p>
                  </div>

                  <FormField control={form.control} name="assignedStoreId" render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-700">
                        Assigned Main / Regional Store{roleNeedsStoreOrOpmc(watchedRole) && !(watchedOpmcIds?.length) ? ' (required: or select a region)' : ''}
                      </FormLabel>
                      <Select onValueChange={(v) => { field.onChange(v); form.clearErrors('assignedStoreId'); }} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-sm bg-white font-semibold text-slate-900">
                            <SelectValue placeholder="-- Select Primary Store --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="text-slate-600 italic">No Direct Store Assignment</SelectItem>
                          {stores.map(st => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {(options?.scopeAll?.[watchedRole]?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-[11px] font-medium text-emerald-950">
                      This role sees <strong>every OPMC / RTOM</strong> in: {options!.scopeAll![watchedRole].map((d) => d.toUpperCase()).join(', ')}. No region is needed; selecting regions here only matters for the other modules.
                    </div>
                  )}

                  <FormField control={form.control} name="opmcIds" render={() => (
                    <FormItem className="space-y-3 pt-2">
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-700 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-600" />
                          Accessible OPMC / RTOM Regions
                          {needsOpmc(watchedRole) && <span className="text-rose-700 normal-case font-bold">required for this role</span>}
                        </FormLabel>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all"
                            checked={watchedOpmcIds?.length === opmcs.length && opmcs.length > 0}
                            onCheckedChange={(checked) => handleSelectAllOpmcs(!!checked)}
                          />
                          <label htmlFor="select-all" className="text-xs text-slate-700 font-medium cursor-pointer">Select All ({opmcs.length})</label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-white rounded-xl border border-slate-300">
                        {opmcs.map((opmc) => {
                          const isChecked = (watchedOpmcIds || []).includes(opmc.id);
                          const toggleOpmc = (check: boolean) => {
                            const current = form.getValues('opmcIds') || [];
                            if (check) {
                              if (!current.includes(opmc.id)) {
                                form.setValue('opmcIds', [...current, opmc.id], { shouldDirty: true });
                              }
                              form.clearErrors('opmcIds');
                            } else {
                              form.setValue('opmcIds', current.filter(id => id !== opmc.id), { shouldDirty: true });
                            }
                          };

                          return (
                            <label
                              key={opmc.id}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2 select-none ${
                                isChecked
                                  ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => toggleOpmc(!!checked)}
                              />
                              <div className="truncate">
                                <div className="text-[11px]">{opmc.name}</div>
                                <div className="text-[9px] text-slate-600 font-normal">RTOM: {opmc.rtom}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Manual grants have their own audited endpoint; the old page-name override is gone because it replaced every role grant */}
                  <div className="pt-4 border-t border-slate-300">
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-[11px] text-slate-800">
                      <p className="font-bold mb-1 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Permissions</p>
                      <p>
                        Permissions come from the system role and the module designations. Changing the role clears any manual permission list.
                        {initialData?.hasCustomGrants && <strong className="block mt-1 text-purple-900">This user has a manual permission list that replaces their role grants.</strong>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </ScrollArea>

            {/* Footer Buttons */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between flex-none">
              <Button
                type="button"
                variant="outline"
                disabled={step === 1 || isSubmitting}
                onClick={handleBack}
                className="h-10 text-xs font-bold border-slate-300 text-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>

              <div className="flex items-center gap-2">
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="h-10 px-6 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                  >
                    {isSubmitting ? 'Saving User...' : (isEdit ? 'Save Changes' : 'Save & Activate User')}
                  </Button>
                )}
              </div>
            </div>

          </form>
        </Form>

      </SheetContent>
    </Sheet>
  );
}
