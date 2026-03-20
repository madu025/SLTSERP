"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { Building2, User, Mail, Phone, MapPin } from "lucide-react";

export function Step1PersonalInfo() {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Simple Step Header */}
            <div className="pb-6 border-b border-slate-200">
                <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">
                    Step 1 of 5
                </h2>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Personal Information
                </h1>
                <p className="text-sm text-slate-900 mt-2 font-bold opacity-80">
                    Please provide your basic contact and registration details correctly.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Name */}
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Full Name / Company Name *
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="Enter full name"
                                        {...field}
                                        value={field.value || ""}
                                        className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                    />
                                    <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                {/* NIC/BRN */}
                <FormField
                    control={control}
                    name="nic"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                NIC or BR Number *
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="Enter NIC or BRN"
                                        {...field}
                                        value={field.value || ""}
                                        className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                    />
                                    <User className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                {/* Email */}
                <FormField
                    control={control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Email Address *
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="email@example.com"
                                        {...field}
                                        value={field.value || ""}
                                        className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                    />
                                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />

                {/* Phone */}
                <FormField
                    control={control}
                    name="contactNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                Contact Number *
                            </FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="07XXXXXXXX"
                                        {...field}
                                        value={field.value || ""}
                                        className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                    />
                                    <Phone className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                        </FormItem>
                    )}
                />
            </div>

            {/* Address */}
            <FormField
                control={control}
                name="address"
                render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                            Physical Address *
                        </FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input
                                    placeholder="Enter full address"
                                    {...field}
                                    value={field.value || ""}
                                    className="h-14 px-5 rounded-xl border-2 border-slate-200 font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                />
                                <MapPin className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            </div>
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                    </FormItem>
                )}
            />
        </div>
    );
}
