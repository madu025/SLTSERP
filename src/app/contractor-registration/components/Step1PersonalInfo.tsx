"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { User, Phone, MapPin, Building2, ShieldCheck, Mail } from "lucide-react";

export function Step1PersonalInfo() {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-100 mb-8">
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Stage 01 | Identity Synchronization</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Corporate Entity Identification</h3>
                <p className="text-sm text-slate-500 max-w-2xl mt-2 leading-relaxed font-bold opacity-80">
                    Provide the official registration details for your contracting institution as recorded in the national corporate registry. 
                    All fields marked with an asterisk (*) are mandatory for verification.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {/* Full Legal Name */}
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-blue-500" /> Full Registered Entity Name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        placeholder="Enter Registered Company Name" 
                                        className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-bold placeholder:text-slate-300" 
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-blue-500 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />

                {/* Registration ID / NIC */}
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-blue-500" /> National ID / Registration No. <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        placeholder="e.g. 199012345678 or 200012345V" 
                                        className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-bold placeholder:text-slate-300 uppercase" 
                                        maxLength={12}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-blue-500 transition-colors">
                                        <User className="w-5 h-5" />
                                    </div>
                                </div>
                            </FormControl>
                            <FormDescription className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Verify numeric accuracy for OCR validation</FormDescription>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />

                {/* Contact Number */}
                <FormField
                    control={control}
                    name="contactNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-blue-500" /> Operational Contact Terminal <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        placeholder="07XXXXXXXX" 
                                        className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-bold placeholder:text-slate-300" 
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-blue-500 transition-colors">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />

                {/* Physical Address */}
                <FormField
                    control={control}
                    name="address"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Official Business Premises <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="group relative transition-all">
                                    <Input 
                                        {...field} 
                                        placeholder="Enter Registered Physical Address" 
                                        className="h-14 px-6 rounded-xl border-slate-200 bg-white shadow-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-bold placeholder:text-slate-300" 
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-blue-500 transition-colors">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
