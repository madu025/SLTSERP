"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { Plus, Trash2, Users, MapPin, BadgeInfo, HardHat, Briefcase } from "lucide-react";

interface Step4Props {
    staticData: { opmcs: { id: string; name: string; rtom: string }[] };
}

export function Step4TeamSelection({ staticData }: Step4Props) {
    const { control } = useFormContext<PublicRegistrationSchema>();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "teams"
    });

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Professional Step Header */}
            <div className="pb-8 border-b border-slate-100 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div className="flex-1">
                    <div className="flex items-center gap-3 text-blue-600 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Stage 04 | Human Resource Configuration</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Operational Personnel Roster</h3>
                    <p className="text-sm text-slate-500 max-w-2xl mt-2 leading-relaxed font-bold opacity-80">
                        Configure your field operational units. Each team must be assigned to a primary SLT jurisdiction (OPMC/RTOM) and populated with verified personnel metrics.
                    </p>
                </div>
                <Button 
                    type="button" 
                    onClick={() => append({ name: `Service Team ${fields.length + 1}`, primaryStoreId: "inherit", members: [] })}
                    className="h-12 px-6 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shrink-0"
                >
                    <Plus className="w-4 h-4" /> Initialize New Unit
                </Button>
            </div>

            <div className="space-y-10">
                {fields.map((team, index) => (
                    <div key={team.id} className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm transition-all hover:border-blue-200 group/team">
                        <div className="p-6 sm:px-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                                    <HardHat className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">{team.name || `Field Unit ${index + 1}`}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Status: Defined</p>
                                    </div>
                                </div>
                            </div>
                            {fields.length > 1 && (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => remove(index)}
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-10 w-10 p-0 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>

                        <div className="p-8 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            {/* Team Name */}
                            <FormField
                                control={control}
                                name={`teams.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2 pl-1">
                                            <BadgeInfo className="w-3.5 h-3.5 text-blue-500" /> Unit Designation <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                placeholder="e.g. Rapid Deployment Team A" 
                                                className="h-12 px-6 rounded-xl border-slate-200 bg-white font-bold transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 shadow-sm"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                                    </FormItem>
                                )}
                            />

                            {/* OPMC Jurisdiction */}
                            <FormField
                                control={control}
                                name={`teams.${index}.opmcId`}
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2 pl-1">
                                            <MapPin className="w-3.5 h-3.5 text-blue-500" /> Regional Jurisdiction (OPMC) <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value || 'inherit'}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 px-6 rounded-xl border-slate-200 bg-white font-bold text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-blue-100">
                                                    <SelectValue placeholder="Select OPMC Office" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-slate-200 shadow-2xl h-80 overflow-y-auto">
                                                <SelectItem value="inherit" className="font-bold py-3 text-blue-600 italic">Universal Registration Default</SelectItem>
                                                {staticData.opmcs.map(opmc => (
                                                    <SelectItem key={opmc.id} value={opmc.id} className="font-bold py-3">
                                                        {opmc.rtom} - {opmc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-500 px-1" />
                                    </FormItem>
                                )}
                            />

                            {/* Personnel Metrics Summary */}
                            <div className="md:col-span-2 p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-400">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold max-w-sm">
                                        Note: Individual personnel identification documents for this unit must be physically submitted upon successful portal synchronization.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Unit Personnel Status</p>
                                    <p className="text-sm font-black text-slate-900">PENDING PHYSICAL AUDIT</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {fields.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">No Operational Units Initialized</h4>
                        <p className="text-xs font-bold text-slate-400 mt-2 italic">At least one service unit is mandatory for SLTS registry</p>
                    </div>
                )}
            </div>
        </div>
    );
}
