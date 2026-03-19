"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { MapPin, AlertCircle, UserCircle } from "lucide-react";

export function Step1PersonalInfo() {
    const { control } = useFormContext<PublicRegistrationSchema>();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
                <div className="p-3 bg-blue-100/50 rounded-2xl text-blue-600 w-fit">
                    <UserCircle className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Primary Contact Identity</h3>
                    <p className="text-sm text-slate-600 font-medium">Provide your official contact and registered legal identity details</p>
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-6 px-1">Contractor Profile</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                            control={control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-700 ml-1">Legal Name / Business Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-12 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="Enter full name" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="contactNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-700 ml-1">Phone Number</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-12 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="07XXXXXXXX" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="brNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-700 ml-1">Business Registration (BR)</FormLabel>
                                    <FormControl>
                                        <Input {...field} value={field.value || ""} className="h-12 text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="Enter BR number" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <FormField
                    control={control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 ml-1">
                                Permanent / Business Address <MapPin className="w-4 h-4 text-blue-500" />
                            </FormLabel>
                            <FormControl>
                                <Textarea {...field} className="min-h-[120px] text-sm font-bold text-slate-900 bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100 transition-all resize-none shadow-inner placeholder:text-slate-400" placeholder="House/Street No, City, Province" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />
            </div>

            <div className="p-5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-200/50 flex gap-4 animate-in slide-in-from-bottom-2 duration-700">
                <div className="p-2.5 bg-white/20 rounded-xl h-fit">
                    <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Verification Notice</p>
                    <p className="text-[11px] text-blue-50 leading-relaxed font-medium">
                        Please ensure your <strong>NIC</strong> and <strong>Full Name</strong> match exactly with your official identification documents for automated processing.
                    </p>
                </div>
            </div>
        </div>
    );
}
