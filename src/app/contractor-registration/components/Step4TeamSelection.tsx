"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { Plus, Trash2, Users, HardHat } from "lucide-react";

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
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Simple Step Header */}
            <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div className="flex-1">
                    <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">
                        Step 4 of 5
                    </h2>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                        Service Teams
                    </h1>
                    <p className="text-sm text-slate-900 mt-2 font-bold opacity-80">
                        Add your operational teams and their primary working area.
                    </p>
                </div>
                <Button 
                    type="button" 
                    onClick={() => append({ name: `Service Team ${fields.length + 1}`, primaryStoreId: "inherit", members: [] })}
                    className="h-12 px-6 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Add Team
                </Button>
            </div>

            <div className="space-y-8">
                {fields.map((team, index) => (
                    <div key={team.id} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-blue-200">
                        <div className="p-5 bg-slate-50 border-b-2 border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                                    <HardHat className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">
                                        {team.name || `Team ${index + 1}`}
                                    </h4>
                                    <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest mt-1 opacity-60 italic">Service Unit</p>
                                </div>
                            </div>
                            {fields.length > 1 && (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => remove(index)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-10 w-10 p-0 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Team Name */}
                            <FormField
                                control={control}
                                name={`teams.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                            Team Name *
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                placeholder="e.g. Field Team A" 
                                                className="h-12 px-5 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 focus:border-blue-600 focus:ring-0 shadow-sm"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                                    </FormItem>
                                )}
                            />

                            {/* OPMC */}
                            <FormField
                                control={control}
                                name={`teams.${index}.opmcId`}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel className="text-[11px] font-bold uppercase text-slate-900 tracking-wider">
                                            Assigned OPMC *
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value || 'inherit'}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 px-5 rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 focus:ring-0">
                                                    <SelectValue placeholder="Select OPMC" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-slate-200 shadow-2xl h-80 overflow-y-auto">
                                                <SelectItem value="inherit" className="font-bold py-3 text-blue-600 italic">Default Office</SelectItem>
                                                {staticData.opmcs.map(opmc => (
                                                    <SelectItem key={opmc.id} value={opmc.id} className="font-bold py-3">
                                                        {opmc.rtom} - {opmc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px] uppercase font-black tracking-widest text-red-600" />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                ))}

                {fields.length === 0 && (
                    <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest opacity-60">No teams added yet</h4>
                        <p className="text-[11px] font-black text-blue-600 mt-2 italic uppercase tracking-widest">Click &apos;Add Team&apos; to begin</p>
                    </div>
                )}
            </div>
        </div>
    );
}
