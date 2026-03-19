"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { MapPin, AlertCircle, UserCircle, Fingerprint } from "lucide-react";

export function Step1PersonalInfo() {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Elite Sub-Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-8 border-b border-white/10 group">
                <div className="p-4 bg-blue-600/20 text-blue-400 rounded-3xl border border-blue-500/20 shadow-2xl transition-all group-hover:scale-110">
                    <UserCircle className="w-8 h-8" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Fingerprint className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Identity Core</span>
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tight">Primary Contact Identity</h3>
                    <p className="text-base text-slate-400 font-semibold leading-relaxed">Provide your official contact and registered legal identity details</p>
                </div>
            </div>

            {/* High-End Input Grid */}
            <div className="space-y-12">
                <div className="space-y-8">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-4 w-1 bg-blue-600 rounded-full" />
                        <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Contractor Profile Parameters</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <FormField
                            control={control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Legal Entity / Business Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-600 shadow-inner" placeholder="Enter full registered name" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold text-rose-400" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="contactNumber"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Secure Contact Terminal</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-600 shadow-inner" placeholder="+94 7X XXX XXXX" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold text-rose-400" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="brNumber"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Business Registration (BRN)</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value || ""} className="h-14 text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-600 shadow-inner" placeholder="Enter unique BR ID" />
                                    </FormControl>
                                    <FormMessage className="text-[10px] font-bold text-rose-400" />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <FormField
                    control={control}
                    name="address"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 ml-1">
                                Geolocation / Business Registry Address <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            </FormLabel>
                            <FormControl>
                                <Textarea {...field} className="min-h-[160px] text-sm font-bold text-white bg-white/[0.03] border-white/10 rounded-[28px] focus:ring-blue-500/20 focus:border-blue-500/50 focus:bg-white/[0.05] transition-all resize-none shadow-inner p-6 placeholder:text-slate-600" placeholder="Specify building, street, and regional province details" />
                            </FormControl>
                            <FormMessage className="text-[10px] font-bold text-rose-400" />
                        </FormItem>
                    )}
                />
            </div>

            {/* Smart Alert Persistence */}
            <div className="p-8 bg-blue-600/10 rounded-[32px] text-white border border-blue-500/20 flex gap-6 animate-in slide-in-from-bottom-4 duration-1000">
                <div className="p-4 bg-blue-500/20 rounded-2xl h-fit border border-blue-400/20">
                    <AlertCircle className="w-6 h-6 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400">Data Integrity Notice</p>
                    <p className="text-[13px] text-blue-100/70 leading-relaxed font-semibold">
                        Critical: Ensure your <strong className="text-white font-black underline decoration-blue-500">Legal Entity Name</strong> matches your government documentation exactly to facilitate rapid automated verification.
                    </p>
                </div>
            </div>
        </div>
    );
}
