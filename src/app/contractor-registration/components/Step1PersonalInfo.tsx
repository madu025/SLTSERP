"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { ShieldCheck, Building2, User, Mail, Phone, MapPin, BadgeInfo } from "lucide-react";

export function Step1PersonalInfo() {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-200">
                <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.3em] flex items-center gap-3 mb-3">
                    <ShieldCheck className="w-4 h-4" /> Module Stage 01 | Identity Synchronization
                </h2>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
                    Corporate Entity <span className="text-blue-600">Identification</span>
                </h1>
                <p className="text-sm text-slate-900 mt-4 leading-relaxed font-bold opacity-90 max-w-2xl">
                    Provide the official registration details for your contracting institution as recorded in the national corporate registry. All fields marked with an asterisk (*) are mandatory for verification.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Entity Name */}
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" /> Full Registered Entity Name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Input
                                        placeholder="Legal entity name as per registry"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        className="h-16 px-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-lg text-slate-900 group-hover:border-blue-300"
                                    />
                                    <Building2 className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                        </FormItem>
                    )}
                />

                {/* Registration Number (NIC/BRN) */}
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <BadgeInfo className="w-4 h-4 text-blue-600" /> National ID / Registration No. <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Input
                                        placeholder="BRN or NIC sequence"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        className="h-16 px-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-lg text-slate-900 group-hover:border-blue-300"
                                    />
                                    <User className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                        </FormItem>
                    )}
                />

                {/* Official Email */}
                <FormField
                    control={control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-600" /> Corporate Correspondence Email <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Input
                                        placeholder="official@company.com"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        className="h-16 px-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-lg text-slate-900 group-hover:border-blue-300"
                                    />
                                    <Mail className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                        </FormItem>
                    )}
                />

                {/* Official Phone Number */}
                <FormField
                    control={control}
                    name="contactNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-widest flex items-center gap-2">
                                <Phone className="w-4 h-4 text-blue-600" /> Operational Contact Terminal <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Input
                                        placeholder="07XXXXXXXX"
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        className="h-16 px-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-lg text-slate-900 group-hover:border-blue-300"
                                    />
                                    <Phone className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                        </FormItem>
                    )}
                />
            </div>

            {/* Permanent Address */}
            <FormField
                control={control}
                name="address"
                render={({ field }) => (
                    <FormItem className="space-y-4">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-widest flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-600" /> Registered Physical Address <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <div className="relative group">
                                <Input
                                    placeholder="Full organizational address as per registry"
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    className="h-16 px-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all focus:ring-4 focus:ring-blue-100 font-bold text-lg text-slate-900 group-hover:border-blue-300"
                                />
                                <MapPin className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600 px-1" />
                    </FormItem>
                )}
            />
        </div>
    );
}
