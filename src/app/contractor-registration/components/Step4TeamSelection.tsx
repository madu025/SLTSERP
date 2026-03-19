"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { Users, Plus, Trash2, UserPlus, Building2, BadgeCheck } from "lucide-react";

interface Store { id: string; name: string }
interface OPMC { id: string; name: string; rtom: string }

interface Step4TeamSelectionProps {
    stores: Store[];
    opmcs: OPMC[];
}

export function Step4TeamSelection({ stores, opmcs }: Step4TeamSelectionProps) {
    const { control, watch, setValue } = useFormContext<PublicRegistrationSchema>();
    const { fields: teams, append: appendTeam, remove: removeTeam } = useFieldArray({
        control,
        name: "teams"
    });

    const addTeam = () => {
        appendTeam({ name: `Field Team ${teams.length + 1}`, primaryStoreId: "", members: [] });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-3 bg-blue-100/50 rounded-2xl text-blue-600 w-fit">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Operational Setup</h3>
                        <p className="text-sm text-slate-600 font-medium">Configure your field teams and jurisdictional base locations</p>
                    </div>
                </div>
                <Button 
                    type="button" 
                    onClick={addTeam} 
                    variant="outline" 
                    className="h-12 px-6 rounded-2xl border-dashed border-blue-400 text-blue-600 hover:bg-blue-50/50 font-bold text-xs uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Team
                </Button>
            </div>

            <div className="space-y-10 pt-4">
                {teams.map((team, tIndex) => (
                    <Card key={team.id} className="border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group rounded-3xl border-2 hover:border-blue-100/50">
                        <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-200">
                                    {tIndex + 1}
                                </span>
                                <Input 
                                    {...control.register(`teams.${tIndex}.name` as const)} 
                                    className="h-10 w-[280px] text-lg font-black bg-transparent border-0 focus-visible:ring-0 px-0 text-slate-800 placeholder:text-slate-300" 
                                    placeholder="Enter Team Name"
                                />
                            </div>
                            {teams.length > 1 && (
                                <Button type="button" onClick={() => removeTeam(tIndex)} variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                        <CardContent className="p-6 sm:p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em] flex items-center gap-2 ml-1">
                                            Primary Base Store <Building2 className="w-4 h-4 text-blue-500" />
                                        </label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.primaryStoreId`, v)} 
                                            value={watch(`teams.${tIndex}.primaryStoreId`) || ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-12 text-sm text-slate-900 font-bold bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100">
                                                    <SelectValue placeholder="Select base store" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <label className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em] ml-1">RTOM Jurisdiction</label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.opmcId`, v)} 
                                            value={watch(`teams.${tIndex}.opmcId`) || "inherit"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-12 text-sm bg-slate-50 border-slate-200 rounded-xl focus:ring-blue-100">
                                                    <SelectValue placeholder="Select OPMC Office" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="inherit">Inherit from Contractor (Recommended)</SelectItem>
                                                {opmcs.map(o => <SelectItem key={o.id} value={o.id}>{o.rtom} - {o.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="bg-slate-50/80 rounded-3xl p-6 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-4 transition-colors hover:bg-blue-50/30">
                                    <div className="p-3 bg-white rounded-2xl text-slate-400 shadow-sm border border-slate-100">
                                        <UserPlus className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[13px] font-black text-slate-700">Team Assignments</p>
                                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed px-4">Register technicians, supervisors, or drivers to this field unit.</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="h-10 px-8 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm bg-white border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all"
                                        onClick={() => {
                                            const currentMembers = watch(`teams.${tIndex}.members`) || [];
                                            setValue(`teams.${tIndex}.members`, [...currentMembers, {
                                                name: `Member ${currentMembers.length + 1}`,
                                                nic: "", contactNumber: "", address: "", designation: "TECHNICIAN",
                                                photoUrl: "", passportPhotoUrl: "", nicUrl: "", policeReportUrl: "", gramaCertUrl: "",
                                                shoeSize: "8", tshirtSize: "Large"
                                            }]);
                                        }}
                                    >
                                        Add Member
                                    </Button>
                                </div>
                            </div>

                            {/* Members Matrix */}
                            {(watch(`teams.${tIndex}.members`) || []).length > 0 && (
                                <div className="mt-10 pt-10 border-t border-slate-100 flex flex-col gap-6 animate-in fade-in duration-500">
                                    <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-[0.2em] flex items-center gap-2 mb-2 px-1">
                                        Team Roster Status <BadgeCheck className="w-5 h-5 text-emerald-500" />
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(watch(`teams.${tIndex}.members`) || []).map((member, mIndex) => (
                                            <div key={mIndex} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-between group/member hover:border-blue-200 hover:shadow-md transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px] border border-blue-100 shadow-inner">
                                                        {member.name?.[0] || 'M'}
                                                    </div>
                                                    <div>
                                                        <input 
                                                            {...control.register(`teams.${tIndex}.members.${mIndex}.name` as const)}
                                                            className="text-sm font-black text-slate-800 block bg-transparent border-0 p-0 focus-visible:ring-0 w-full"
                                                            placeholder="Member Name"
                                                        />
                                                        <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">{member.designation}</span>
                                                    </div>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    onClick={() => {
                                                        const current = watch(`teams.${tIndex}.members`);
                                                        setValue(`teams.${tIndex}.members`, current.filter((_, idx) => idx !== mIndex));
                                                    }}
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-neutral-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Bottom Notice */}
            <div className="p-5 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200/50 flex gap-4 mt-8 animate-in slide-in-from-bottom-4 duration-1000">
                <div className="p-2.5 bg-white/20 rounded-2xl h-fit shadow-inner">
                    <Users className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Operational Notice</p>
                    <p className="text-[11px] text-blue-50 leading-relaxed font-medium">
                        Field teams are jurisdictional units linked to RTOMs. You can accurately configure your full roster now, or continue the setup later via your <strong>Contractor Dashboard</strong> after initial approval.
                    </p>
                </div>
            </div>
        </div>
    );
}
