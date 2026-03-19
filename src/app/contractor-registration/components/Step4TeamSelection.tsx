"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";
import { Users, Plus, Trash2, UserPlus, Building2, BadgeCheck, Network, Map, Zap } from "lucide-react";

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
        <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Elite Sub-Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 pb-8 border-b border-white/10 group">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="p-4 bg-blue-600/20 text-blue-400 rounded-3xl border border-blue-500/20 shadow-2xl transition-all group-hover:scale-110">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Network className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Logistics Grid Architecture</span>
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tight">Operational Setup</h3>
                        <p className="text-base text-slate-400 font-semibold leading-relaxed">Configure your field teams and jurisdictional base locations</p>
                    </div>
                </div>
                <Button 
                    type="button" 
                    onClick={addTeam} 
                    className="h-16 px-10 rounded-[28px] bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.3em] shadow-[0_15px_40px_rgba(37,99,235,0.4)] transition-all hover:scale-105 active:scale-95 border border-blue-400/20"
                >
                    <Plus className="w-5 h-5 mr-3" /> Initialize New Unit
                </Button>
            </div>

            <div className="space-y-12 pt-4">
                {teams.map((team, tIndex) => (
                    <Card key={team.id} className="relative border-white/5 overflow-hidden shadow-2xl rounded-[40px] bg-white/[0.02] backdrop-blur-3xl border hover:border-blue-500/30 transition-all duration-700 group ring-1 ring-white/5">
                        <div className="bg-white/[0.03] p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <span className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-2xl shadow-blue-500/30 ring-2 ring-white/20">
                                    {tIndex + 1}
                                </span>
                                <Input 
                                    {...control.register(`teams.${tIndex}.name` as const)} 
                                    className="h-12 w-[320px] text-2xl font-black bg-transparent border-0 focus-visible:ring-0 px-0 text-white placeholder:text-slate-800 tracking-tight" 
                                    placeholder="TEAM DESIGNATION"
                                />
                            </div>
                            {teams.length > 1 && (
                                <Button type="button" onClick={() => removeTeam(tIndex)} variant="ghost" size="icon" className="h-12 w-12 text-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all">
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                        <CardContent className="p-8 sm:p-12 space-y-12">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-2 ml-1">
                                            PRIMARY LOGISTICS HUB <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                        </label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.primaryStoreId`, v)} 
                                            value={watch(`teams.${tIndex}.primaryStoreId`) || ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-14 text-sm text-white font-bold bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 transition-all shadow-inner">
                                                    <SelectValue placeholder="Select base store" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl">
                                                {stores.map(s => <SelectItem key={s.id} value={s.id} className="py-3 text-white font-bold focus:bg-blue-600/20 focus:text-blue-400">{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-2 ml-1">
                                            JURISDICTIONAL OPMC <Map className="w-3.5 h-3.5 text-blue-500" />
                                        </label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.opmcId`, v)} 
                                            value={watch(`teams.${tIndex}.opmcId`) || "inherit"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-14 text-sm text-white font-bold bg-white/[0.03] border-white/10 rounded-2xl focus:ring-blue-500/20 transition-all shadow-inner">
                                                    <SelectValue placeholder="Select OPMC Office" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl">
                                                <SelectItem value="inherit" className="py-3 text-white font-bold focus:bg-blue-600/20 focus:text-blue-400 italic">Inherit Parent RTOM (Global)</SelectItem>
                                                {opmcs.map(o => <SelectItem key={o.id} value={o.id} className="py-3 text-white font-bold focus:bg-blue-600/20 focus:text-blue-400">{o.rtom} • {o.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="bg-white/[0.03] rounded-[32px] p-10 border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-6 transition-all hover:bg-blue-600/[0.05] hover:border-blue-500/30 group/add">
                                    <div className="p-5 bg-slate-950 rounded-2xl text-blue-500 shadow-2xl border border-white/5 transition-transform group-hover/add:scale-110">
                                        <UserPlus className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-base font-black text-white tracking-tight">Personnel Roster</p>
                                        <p className="text-[12px] text-slate-500 font-bold leading-relaxed px-6">Assign technicians, supervisors, or drivers to this synchronized field unit.</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        className="h-12 px-10 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/20 transition-all hover:scale-105"
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
                                        Deploy Member
                                    </Button>
                                </div>
                            </div>

                            {/* Personnel Synchronicity Hub */}
                            {(watch(`teams.${tIndex}.members`) || []).length > 0 && (
                                <div className="mt-12 pt-12 border-t border-white/10 flex flex-col gap-8 animate-in fade-in duration-1000">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-3">
                                            LIVE UNIT ROSTER <BadgeCheck className="w-5 h-5 text-emerald-500" />
                                        </h4>
                                        <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{(watch(`teams.${tIndex}.members`) || []).length} ACTIVE HANDS</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {(watch(`teams.${tIndex}.members`) || []).map((member, mIndex) => (
                                            <div key={mIndex} className="p-5 rounded-[24px] border border-white/5 bg-white/[0.02] shadow-2xl flex items-center justify-between group/member hover:border-blue-500/30 hover:bg-white/[0.04] transition-all relative overflow-hidden ring-1 ring-white/5">
                                                <div className="flex items-center gap-4 relative z-10 w-full">
                                                    <div className="h-12 w-12 rounded-2xl bg-slate-950 text-blue-400 flex items-center justify-center font-black text-[12px] border border-white/10 shadow-inner">
                                                        {member.name?.[0] || 'M'}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <input 
                                                            {...control.register(`teams.${tIndex}.members.${mIndex}.name` as const)}
                                                            className="text-sm font-black text-white block bg-transparent border-0 p-0 focus-visible:ring-0 w-full tracking-tight"
                                                            placeholder="Member Designation"
                                                        />
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            <span className="text-[9px] text-blue-400 font-black uppercase tracking-[0.1em]">{member.designation}</span>
                                                        </div>
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
                                                    className="h-10 w-10 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all relative z-10"
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

            {/* Elite Operational Banner */}
            <div className="p-8 bg-blue-600/10 rounded-[40px] text-white border border-blue-500/20 flex gap-8 mt-12 animate-in slide-in-from-bottom-6 duration-1000 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                <div className="p-4 bg-blue-500/20 rounded-2xl h-fit border border-blue-400/20 shadow-2xl transition-transform hover:scale-110">
                    <Users className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-400">Operational Grid Sync</p>
                    </div>
                    <p className="text-[14px] text-blue-100/70 leading-relaxed font-semibold">
                        Field units are jurisdictional assets linked to primary OPMCs. Full personnel audit compliance is mandatory. You may finalize your roster in this terminal or synchronize later via the <strong className="text-white underline decoration-blue-500">Contractor Hub</strong> post-clearance.
                    </p>
                </div>
            </div>
        </div>
    );
}
