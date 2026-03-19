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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                    <UserCircle className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                    <p className="text-xs text-slate-500">Provide your official contact and identity details</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5 pt-4">
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal Name / Business Name</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-11 text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all" placeholder="Enter full name" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="contactNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5 pt-4">
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-11 text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all" placeholder="07XXXXXXXX" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />



                <FormField
                    control={control}
                    name="brNumber"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5 pt-4">
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Business Registration (BR)</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value || ""} className="h-11 text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all" placeholder="Enter BR number (If available)" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name="address"
                render={({ field }) => (
                    <FormItem className="space-y-1.5 pt-4">
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            Permanent / Business Address <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        </FormLabel>
                        <FormControl>
                            <Textarea {...field} className="min-h-[100px] text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all resize-none" placeholder="House/Street No, City, Province" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
            />

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 animate-in slide-in-from-bottom-2 duration-700">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>Notice:</strong> Please ensure your NIC and Full Name match exactly with your official identification documents. Our system uses automated verification to process applications faster.
                </div>
            </div>
        </div>
    );
}
