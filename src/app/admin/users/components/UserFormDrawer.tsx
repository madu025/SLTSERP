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

// Available pages for permission override
const AVAILABLE_PAGES = [
    { id: 'dashboard', name: 'Dashboard', icon: '' },
    { id: 'service-orders', name: 'Service Orders', icon: '' },
    { id: 'contractors', name: 'Contractors', icon: '' },
    { id: 'restore-requests', name: 'Restore Requests', icon: '' },
    { id: 'invoices', name: 'Invoices', icon: '💰' },
    { id: 'inventory', name: 'Inventory / Stores', icon: '📦' },
    { id: 'procurement', name: 'Procurement', icon: '🛒' },
    { id: 'administration', name: 'Administration', icon: '⚙️' }
];

// Zod Schema
const userSchema = z.object({
  username: z.string().min(3, "Username required (min 3 chars)"),
  email: z.string().email("Invalid email address"),
  password: z.string().optional(),
  name: z.string().min(2, "Full name required"),
  role: z.string().min(1, "Role selection is required"),
  employeeId: z.string().optional(),
  opmcIds: z.array(z.string()),
  supervisorId: z.string().optional(),
  assignedStoreId: z.string().optional(),
  status: z.string().optional(),
  permissions: z.array(z.string()).optional(),
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
  sectionAssignments?: Array<{
    id: string;
    section: { id: string; name: string };
    role: { id: string; name: string };
    isPrimary: boolean;
  }>;
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

interface UserFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UserFormValues & { sectionAssignments?: Array<{ sectionId: string; roleId: string; isPrimary: boolean }> }) => void;
  initialData?: UserFormValues & { 
    id?: string;
    sectionAssignments?: Array<{
      id: string;
      section: { id: string; name: string };
      role: { id: string; name: string };
      isPrimary: boolean;
    }>;
  };
  isSubmitting: boolean;
  users: UserProp[];
  opmcs: OpmcProp[];
  stores: StoreProp[];
}

export function UserFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
  users,
  opmcs,
  stores
}: UserFormDrawerProps) {
  const [step, setStep] = useState(1);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [sectionAssignments, setSectionAssignments] = useState<Array<{
    id?: string;
    sectionId: string;
    roleId: string;
    sectionName?: string;
    roleName?: string;
    isPrimary: boolean;
  }>>([]);

  const form = useForm<UserFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userSchema) as any,
    defaultValues: initialData || {
      username: '',
      email: '',
      password: '',
      name: '',
      role: '',
      employeeId: '',
      opmcIds: [],
      supervisorId: '',
      assignedStoreId: 'none',
      status: 'active',
      permissions: []
    }
  });

  const watchedOpmcIds = useWatch({ control: form.control, name: 'opmcIds' });
  const watchedRole = useWatch({ control: form.control, name: 'role' });
  const watchedPermissions = useWatch({ control: form.control, name: 'permissions' });

  // Dynamic role options — source of truth is the Postgres Role enum (GET /api/admin/role-options)
  const { data: roleOptions } = useQuery<{ roles: string[]; categories: Record<string, string[]> }>({
    queryKey: ['role-options'],
    queryFn: async () => {
      const res = await fetch('/api/admin/role-options');
      if (!res.ok) throw new Error('Failed to load role options');
      return res.json();
    },
    staleTime: 5 * 60 * 1000
  });

  // Group enum roles by category; unmapped roles land in "Other" so new enum values never vanish from the UI
  const roleCategories = useMemo<Record<string, string[]>>(() => {
    const roles = roleOptions?.roles || [];
    const categories = roleOptions?.categories || {};
    const grouped: Record<string, string[]> = {};
    const mapped = new Set<string>();
    for (const [cat, catRoles] of Object.entries(categories)) {
      const present = catRoles.filter((r) => roles.includes(r));
      if (present.length) grouped[cat] = present;
      present.forEach((r) => mapped.add(r));
    }
    const other = roles.filter((r) => !mapped.has(r));
    if (other.length) grouped['Other'] = other;
    return grouped;
  }, [roleOptions]);

  // Sync form and section when drawer opens/closes
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (initialData) {
        form.reset({
          ...initialData,
          password: '', // Clear password field for security edit
          assignedStoreId: initialData.assignedStoreId || 'none',
          opmcIds: initialData.opmcIds || [],
          status: initialData.status || 'active',
          permissions: initialData.permissions || []
        });
        const section = Object.entries(roleCategories).find(([, roles]) => roles.includes(initialData.role))?.[0] || null;
        setSelectedSection(section);
        
        // Load existing section assignments for edit mode
        if (initialData.id && initialData.sectionAssignments) {
          const assignments = initialData.sectionAssignments.map(a => ({
            id: a.id,
            sectionId: a.section.id,
            roleId: a.role.id,
            sectionName: a.section.name,
            roleName: a.role.name,
            isPrimary: a.isPrimary
          }));
          setSectionAssignments(assignments);
        } else {
          setSectionAssignments([]);
        }
        setStep(1);
      } else {
        form.reset({
          username: '',
          email: '',
          password: '',
          name: '',
          role: '',
          employeeId: '',
          opmcIds: [],
          supervisorId: '',
          assignedStoreId: 'none',
          status: 'active',
          permissions: []
        });
        setSelectedSection(null);
        setStep(1);
      }
    }, 0);
    return () => clearTimeout(timer);
    // roleCategories in deps: re-resolve section for edit mode once async role options load
  }, [open, initialData, form, roleCategories]);

  const handleSelectAllOpmcs = (checked: boolean) => {
    if (checked) {
      form.setValue('opmcIds', opmcs.map(o => o.id));
    } else {
      form.setValue('opmcIds', []);
    }
  };

  const [supervisorSearch, setSupervisorSearch] = useState('');

  // Supervisors list filter: Exclude self and external contractor users
  const potentialSupervisors = useMemo(() => {
    return users.filter(u => {
      if (u.id === initialData?.id) return false;
      if (u.contractorId) return false;
      if (u.role && u.role.startsWith('CONTRACTOR')) return false;
      return true;
    });
  }, [users, initialData]);

  const filteredSupervisors = useMemo(() => {
    if (!supervisorSearch.trim()) return potentialSupervisors;
    const query = supervisorSearch.toLowerCase();
    return potentialSupervisors.filter(u => 
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.username && u.username.toLowerCase().includes(query)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(query)) ||
      (u.role && u.role.toLowerCase().includes(query))
    );
  }, [potentialSupervisors, supervisorSearch]);

  const handleFormSubmit = (data: UserFormValues) => {
    onSubmit({
      ...data,
      assignedStoreId: data.assignedStoreId === 'none' ? undefined : data.assignedStoreId,
      supervisorId: data.supervisorId === 'none' ? undefined : data.supervisorId,
      sectionAssignments: sectionAssignments.map(a => ({
        sectionId: a.sectionId,
        roleId: a.roleId,
        isPrimary: a.isPrimary
      }))
    });
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (step === 1) {
      const isValid = await form.trigger(['username', 'email', 'name']);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-slate-50 border-l border-slate-200 overflow-hidden">
        
        {/* Header */}
        <SheetHeader className="bg-slate-900 text-white p-6 pb-5 flex-none relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                {initialData?.id ? 'Edit User Details' : 'Create New System User'}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-400">
                {initialData?.id ? `Updating credentials & permissions for ${initialData.name || initialData.username}` : 'Configure credentials, organizational roles, and warehouse access scopes.'}
              </SheetDescription>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800">
            {stepsList.map((st) => (
              <button
                key={st.num}
                type="button"
                onClick={() => setStep(st.num)}
                className={`flex flex-col text-left p-2 rounded-xl transition-all border ${
                  step === st.num
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : step > st.num
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Step {st.num}</span>
                  {step > st.num && <Check className="w-3 h-3 text-emerald-400" />}
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
                  <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-900 leading-relaxed font-medium">
                      Enter staff identity details and login credentials. User will use the username/email to log in.
                    </p>
                  </div>

                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kasun Sanjeewa" className="h-10 text-sm bg-white" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Username</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 433 or kasun" className="h-10 text-sm bg-white" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Employee / Staff ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. EMP-1049" className="h-10 text-sm bg-white" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="sanjeewa@slts.lk" className="h-10 text-sm bg-white" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Account Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'active'}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm bg-white">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active (Full Access)</SelectItem>
                            <SelectItem value="inactive">Inactive (Disabled)</SelectItem>
                            <SelectItem value="resigned">Resigned / Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600">
                        Password {initialData?.id && '(Leave blank to keep current)'}
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" className="h-10 text-sm bg-white" {...field} value={field.value || ''} />
                      </FormControl>
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
                    <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-2xl flex items-center gap-3">
                      <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                        Select the user&apos;s department and operational role. Roles define RBAC permissions and process gate approval authority.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600">1. Department / Division</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          setSelectedSection(val);
                          form.setValue('role', '');
                        }}
                        value={currentSection || ''}
                      >
                        <SelectTrigger className="h-11 text-sm bg-white font-semibold">
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
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-600">2. System Role</FormLabel>
                        <FormControl>
                          <Select
                            disabled={!currentSection}
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="h-11 text-sm bg-white font-bold text-indigo-900 border-indigo-200">
                              <SelectValue placeholder={currentSection ? "-- Select System Role --" : "First select a department above..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {currentSection && roleCategories[currentSection]?.map((role: string) => (
                                <SelectItem key={role} value={role} className="font-medium">
                                  {role.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                  <FormField control={form.control} name="supervisorId" render={({ field }) => (
                    <FormItem className="space-y-2 pt-2">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Reporting Supervisor (Optional)</FormLabel>
                      <div className="space-y-1.5">
                        <Input
                          type="text"
                          placeholder="🔍 Type to search supervisor (Name, Employee ID, Role)..."
                          value={supervisorSearch}
                          onChange={(e) => setSupervisorSearch(e.target.value)}
                          className="h-9 text-xs bg-white border-slate-200"
                        />
                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm bg-white font-semibold">
                              <SelectValue placeholder="-- Select Supervisor --" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            <SelectItem value="none" className="text-slate-400 italic">None (Independent Officer)</SelectItem>
                            {filteredSupervisors.map(u => (
                              <SelectItem key={u.id} value={u.id!}>
                                👤 {u.name || u.username} {u.employeeId ? `(#${u.employeeId})` : ''} • [{u.role.replace(/_/g, ' ')}]
                              </SelectItem>
                            ))}
                            {filteredSupervisors.length === 0 && (
                              <div className="p-2 text-xs text-slate-400 italic text-center">No internal supervisors found</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {watchedRole && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                      <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Configured Role: <strong>{watchedRole.replace(/_/g, ' ')}</strong></span>
                    </div>
                  )}
                </div>
              );
            })()}

              {/* STEP 3: Store & OPMC Scopes */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-amber-50/60 border border-amber-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <StoreIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      Assign warehouse stores and regional RTOM scopes. Users can manage materials and approvals within their assigned scopes.
                    </p>
                  </div>

                  <FormField control={form.control} name="assignedStoreId" render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600">Assigned Main / Regional Store</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-sm bg-white font-semibold">
                            <SelectValue placeholder="-- Select Primary Store --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="text-slate-400 italic">No Direct Store Assignment</SelectItem>
                          {stores.map(st => (
                            <SelectItem key={st.id} value={st.id}>
                              📦 {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Accessible OPMC / RTOM Regions
                      </FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={watchedOpmcIds?.length === opmcs.length && opmcs.length > 0}
                          onCheckedChange={(checked) => handleSelectAllOpmcs(!!checked)}
                        />
                        <label htmlFor="select-all" className="text-xs text-slate-500 font-medium cursor-pointer">Select All ({opmcs.length})</label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-white rounded-xl border border-slate-200">
                      {opmcs.map((opmc) => {
                        const isChecked = (watchedOpmcIds || []).includes(opmc.id);
                        const toggleOpmc = (check: boolean) => {
                          const current = form.getValues('opmcIds') || [];
                          if (check) {
                            if (!current.includes(opmc.id)) {
                              form.setValue('opmcIds', [...current, opmc.id], { shouldDirty: true });
                            }
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
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <Checkbox 
                              checked={isChecked} 
                              onCheckedChange={(checked) => toggleOpmc(!!checked)}
                            />
                            <div className="truncate">
                              <div className="text-[11px]">{opmc.name}</div>
                              <div className="text-[9px] text-slate-400 font-normal">RTOM: {opmc.rtom}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Permission Override Section */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <FormLabel className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        Permission Override (Optional)
                      </FormLabel>
                      <span className="text-[10px] text-slate-400">Leave empty to use role defaults</span>
                    </div>

                    <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl">
                      <p className="text-[10px] text-purple-900 mb-3">
                        Override default role permissions. Leave unchecked to use role-based permissions from admin/roles.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_PAGES.map((page) => {
                          const isChecked = (watchedPermissions || []).includes(page.id);
                          const togglePermission = (check: boolean) => {
                            const current = form.getValues('permissions') || [];
                            if (check) {
                              if (!current.includes(page.id)) {
                                form.setValue('permissions', [...current, page.id], { shouldDirty: true });
                              }
                            } else {
                              form.setValue('permissions', current.filter(p => p !== page.id), { shouldDirty: true });
                            }
                          };

                          return (
                            <label
                              key={page.id}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2 select-none ${
                                isChecked
                                  ? 'bg-purple-50 border-purple-500 text-purple-950 font-bold'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <Checkbox 
                                checked={isChecked} 
                                onCheckedChange={(checked) => togglePermission(!!checked)}
                              />
                              <span>{page.icon} {page.name}</span>
                            </label>
                          );
                        })}
                      </div>
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
                className="h-10 text-xs font-bold"
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
                    className="h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-200"
                  >
                    {isSubmitting ? 'Saving User...' : 'Save & Activate User'}
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
