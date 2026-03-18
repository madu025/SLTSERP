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
        appendTeam({ name: `Team ${teams.length + 1}`, primaryStoreId: "", members: [] });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Operational Setup</h3>
                        <p className="text-xs text-slate-500">Configure your field teams and base locations</p>
                    </div>
                </div>
                <Button type="button" onClick={addTeam} variant="outline" size="sm" className="h-9 text-xs border-dashed border-blue-500 text-blue-600 hover:bg-blue-50/50">
                    <Plus className="w-4 h-4 mr-2" /> New Team
                </Button>
            </div>

            <div className="space-y-8 pt-4">
                {teams.map((team, tIndex) => (
                    <Card key={team.id} className="border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                        <div className="bg-slate-50/50 p-4 border-b flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                    {tIndex + 1}
                                </span>
                                <Input 
                                    {...control.register(`teams.${tIndex}.name` as const)} 
                                    className="h-9 w-[240px] text-sm font-bold bg-transparent border-0 focus-visible:ring-0 px-0" 
                                />
                            </div>
                            {teams.length > 1 && (
                                <Button type="button" onClick={() => removeTeam(tIndex)} variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                                            Primary Base Store <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                        </label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.primaryStoreId`, v)} 
                                            value={watch(`teams.${tIndex}.primaryStoreId`) || ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-10 text-xs">
                                                    <SelectValue placeholder="Select base store" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5 pt-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Base OPMC (RTOM)</label>
                                        <Select 
                                            onValueChange={(v) => setValue(`teams.${tIndex}.opmcId`, v)} 
                                            value={watch(`teams.${tIndex}.opmcId`) || "inherit"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-10 text-xs">
                                                    <SelectValue placeholder="Select RTOM Jurisdiction" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="inherit">Inherit from Contractor</SelectItem>
                                                {opmcs.map(o => <SelectItem key={o.id} value={o.id}>{o.rtom} - {o.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="bg-slate-50/50 rounded-xl p-4 border border-dashed flex flex-col items-center justify-center text-center gap-3">
                                    <div className="p-2.5 bg-white rounded-full text-slate-400 shadow-sm">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-600">Assign Members</p>
                                        <p className="text-[10px] text-slate-400 leading-tight">Add staff members, technicians, or drivers to this team.</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-[11px] font-bold px-6 shadow-sm bg-white"
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
                                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col gap-4">
                                    <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2 mb-2">
                                        Team Roster <BadgeCheck className="w-4 h-4 text-green-500" />
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(watch(`teams.${tIndex}.members`) || []).map((member, mIndex) => (
                                            <div key={mIndex} className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center justify-between group/member hover:border-blue-200 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                                                        {member.name?.[0] || 'M'}
                                                    </div>
                                                    <div>
                                                        <input 
                                                            {...control.register(`teams.${tIndex}.members.${mIndex}.name` as const)}
                                                            className="text-xs font-bold text-slate-800 block bg-transparent border-0 p-0 focus-visible:ring-0"
                                                            placeholder="Member Name"
                                                        />
                                                        <span className="text-[10px] text-slate-400 uppercase font-medium">{member.designation}</span>
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
                                                    className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-neutral-100 opacity-0 group-hover/member:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
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

            <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100 flex gap-4 mt-8">
                <div className="p-3 bg-white rounded-full shadow-sm text-blue-600">
                    <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Operational Logic</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Teams are linked to specific Stores and RTOMs for logistics and task assignment. 
                        <strong> Note:</strong> You can add all staff members now, or add them later after initial approval via the dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
}
