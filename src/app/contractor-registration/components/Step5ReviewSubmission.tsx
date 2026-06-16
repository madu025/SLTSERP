"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { FileText, ImageIcon, ShieldCheck, Banknote, Users, AlertCircle, BadgeCheck, Building2, ClipboardCheck } from "lucide-react";

interface ReviewSectionProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}

const ReviewSection = ({ icon: Icon, title, children }: ReviewSectionProps) => (
    <div className="space-y-6 p-8 rounded-3xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200">
        <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-200">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-900 border-2 border-slate-200 shadow-inner">
                <Icon className="w-5 h-5" />
            </div>
            <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-widest">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {children}
        </div>
    </div>
);

const ReviewItem = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="space-y-1 group">
        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block opacity-60">{label}</span>
        <p className="text-[15px] font-black text-slate-900 truncate tracking-tight">{value || "NOT PROVIDED"}</p>
    </div>
);

const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
    <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                {url?.match(/\.(pdf)$/i) ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{label}</span>
        </div>
        {url ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg border-2 border-emerald-100">
                <BadgeCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">OK</span>
            </div>
        ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-rose-50 text-rose-500 rounded-lg border-2 border-rose-100">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">MISSING</span>
            </div>
        )}
    </div>
);

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Simple Step Header */}
            <div className="text-center space-y-4 pb-6 border-b-2 border-slate-200">
                <div className="inline-flex h-16 w-16 items-center justify-center bg-blue-50 rounded-2xl text-blue-600 mb-2 border-2 border-blue-100 shadow-inner">
                    <ClipboardCheck className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">
                        Final Step
                    </h2>
                    <h3 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight uppercase">Review Your Details</h3>
                    <p className="text-sm text-slate-900 max-w-xl mx-auto font-bold opacity-80 uppercase tracking-tight">
                        Please check all information before submitting your registration.
                    </p>
                </div>
            </div>

            <div className="space-y-8">
                <ReviewSection icon={Building2} title="Business Details">
                    <ReviewItem label="Official Name" value={data.name} />
                    <ReviewItem label="NIC / BR Number" value={data.nic} />
                    <ReviewItem label="Phone Number" value={data.contactNumber} />
                    <ReviewItem label="Address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Bank Details">
                    <ReviewItem label="Bank Name" value={data.bankName} />
                    <ReviewItem label="Account Number" value={data.bankAccountNumber} />
                    <ReviewItem label="Branch" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Team Summary">
                    <ReviewItem label="Total Units" value={(data.teams?.length || 0).toString()} />
                    <ReviewItem label="Personnel Total" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                </ReviewSection>

                <div className="space-y-6">
                    <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-wider pl-1 font-mono">Operations Personnel</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {(data.teams || []).map((team, tIdx) => (
                            <div key={tIdx} className="p-8 rounded-[32px] border-2 border-slate-200 bg-white/50 space-y-6 transition-all hover:bg-white hover:border-blue-200 hover:shadow-xl hover:scale-[1.01] duration-500">
                                <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-100">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                                        <BadgeCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none">{team.name}</h5>
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1 opacity-80">{team.members?.length || 0} Members Registered</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {(team.members || []).map((member, mIdx) => (
                                        <div key={mIdx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-100/50 border-2 border-slate-200 shadow-sm">
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{member.name}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{member.nic}</p>
                                            </div>
                                            {member.passportPhotoUrl ? (
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-rose-500 ring-4 ring-rose-50" />
                                            )}
                                        </div>
                                    ))}
                                    {(team.members || []).length === 0 && (
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center py-4 border-2 border-dashed border-slate-200 rounded-2xl">No personnel listed</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-wider pl-1">Uploaded Documents</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ReviewDoc label="NIC Front" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Back" url={data.nicBackUrl} />
                        <ReviewDoc label="Portrait" url={data.photoUrl} />
                        <ReviewDoc label="Bank Book" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Fee Receipt" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="BR Certificate" url={data.brCertUrl} />
                    </div>
                </div>
            </div>

            {/* Simple Legal Footer */}
            <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-xl mt-8 border-t-8 border-blue-600">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="p-4 bg-white/10 rounded-2xl h-fit border-2 border-white/20">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-2 flex-1 text-center md:text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Confirmation</p>
                        <p className="text-sm text-slate-200 leading-relaxed font-bold tracking-tight opacity-90">
                            I certify that all information provided is accurate and all documents represent authentic copies.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
