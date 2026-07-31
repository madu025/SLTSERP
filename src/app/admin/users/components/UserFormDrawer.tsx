"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { Shield, User, ChevronLeft, ChevronRight, Check, Sparkles, Building2, Store as StoreIcon, Key, BadgeCheck } from "lucide-react";
import { ROLE_CATEGORIES } from '../constants/roles';

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
});

export type UserFormValues = z.infer<typeof userSchema>;

export interface UserProp {
  id?: string;
  name?: string | null;
  username?: string;
  role: string;
  accessibleOpmcs?: { id: string }[];
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
  onSubmit: (values: UserFormValues) => void;
  initialData?: UserFormValues & { id?: string };
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
      status: 'active'
    }
  });

  const watchedOpmcIds = useWatch({ control: form.control, name: 'opmcIds' });
  const watchedRole = useWatch({ control: form.control, name: 'role' });

  // Sync form and section when drawer opens/closes
  useEffect(() => {
    if (!open) return;
    if (initialData) {
      form.reset({
        ...initialData,
        password: '', // Clear password field for security edit
        assignedStoreId: initialData.assignedStoreId || 'none',
        opmcIds: initialData.opmcIds || [],
        status: initialData.status || 'active'
      });
      const section = Object.entries(ROLE_CATEGORIES).find(([, roles]) => roles.includes(initialData.role))?.[0] || null;
      setSelectedSection(section);
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
        status: 'active'
      });
      setSelectedSection(null);
      setStep(1);
    }
  }, [open, initialData?.username, initialData?.role]);

  const handleSelectAllOpmcs = (checked: boolean) => {
    if (checked) {
      form.setValue('opmcIds', opmcs.map(o => o.id));
    } else {
      form.setValue('opmcIds', []);
    }
  };

  // Supervisors list filter
  const potentialSupervisors = useMemo(() => {
    return users.filter(u => u.id !== initialData?.id);
  }, [users, initialData]);

  const handleFormSubmit = (data: UserFormValues) => {
    onSubmit({
      ...data,
      assignedStoreId: data.assignedStoreId === 'none' ? undefined : data.assignedStoreId,
      supervisorId: data.supervisorId === 'none' ? undefined : data.supervisorId
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
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                      Select the user's department and operational role. Roles define RBAC permissions and process gate approval authority.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <FormLabel className="text-[11px] font-bold uppercase text-slate-600">1. Department / Division</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        setSelectedSection(val);
                        form.setValue('role', '');
                      }}
                      value={selectedSection || ''}
                    >
                      <SelectTrigger className="h-11 text-sm bg-white font-semibold">
                        <SelectValue placeholder="-- Select Department --" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ROLE_CATEGORIES).map(cat => (
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
                          disabled={!selectedSection}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger className="h-11 text-sm bg-white font-bold text-indigo-900 border-indigo-200">
                            <SelectValue placeholder={selectedSection ? "-- Select System Role --" : "First select a department above..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedSection && ROLE_CATEGORIES[selectedSection as keyof typeof ROLE_CATEGORIES]?.map(role => (
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
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger className="h-10 text-sm bg-white">
                            <SelectValue placeholder="-- Select Supervisor --" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="text-slate-400 italic">None (Independent Officer)</SelectItem>
                          {potentialSupervisors.map(u => (
                            <SelectItem key={u.id} value={u.id!}>
                              {u.name || u.username} ({u.role.replace(/_/g, ' ')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              )}

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
