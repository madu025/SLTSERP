"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { CheckCircle2, FileText, ImageIcon, ShieldCheck, Banknote, Users, AlertCircle, BadgeCheck, Fingerprint, Zap, Scale } from "lucide-react";

interface ReviewSectionProps {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}

const ReviewSection = ({ icon: Icon, title, children }: ReviewSectionProps) => (
    <div className="space-y-8 p-10 sm:p-12 rounded-[48px] border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-2xl transition-all hover:bg-white/[0.04] ring-1 ring-white/5">
        <div className="flex items-center gap-6 pb-6 border-b border-white/5">
            <div className="p-4 bg-blue-600/20 rounded-2xl border border-blue-500/20 text-blue-400 shadow-xl">
                <Icon className="w-6 h-6" />
            </div>
            <h4 className="text-[12px] font-black uppercase text-white tracking-[0.4em]">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4">
            {children}
        </div>
    </div>
);

const ReviewItem = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="space-y-3 group p-6 rounded-[28px] bg-slate-950/40 border border-white/5 transition-all hover:bg-slate-950/60 hover:border-blue-500/30">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block ml-1 group-hover:text-blue-500 transition-colors">{label}</span>
        <p className="text-[16px] font-black text-white truncate leading-relaxed mt-1 tracking-tight">{value || "NOT PROVIDED"}</p>
    </div>
);

const ReviewDoc = ({ label, url }: { label: string; url?: string | null }) => (
    <div className="flex items-center justify-between p-6 rounded-[32px] border border-white/5 bg-slate-950/40 shadow-2xl overflow-hidden group hover:border-emerald-500/30 transition-all hover:bg-slate-950/60 h-[88px] ring-1 ring-white/5">
        <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600/20 group-hover:text-emerald-400 transition-all shadow-inner">
                {url?.match(/\.(pdf)$/i) ? <FileText className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] block">SECURE REGISTRY</span>
                <span className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors tracking-tight">{label}</span>
            </div>
        </div>
        {url ? (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-2xl animate-in zoom-in-90 duration-500">
                <BadgeCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">VERIFIED</span>
            </div>
        ) : (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20 opacity-80 ring-1 ring-rose-500/20">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">REQUIRED</span>
            </div>
        )}
    </div>
);

export function Step5ReviewSubmission() {
    const { watch } = useFormContext<PublicRegistrationSchema>();
    const data = watch();

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Elite Review Hub Header */}
            <div className="text-center space-y-8 pb-4">
                <div className="relative inline-flex h-28 w-28 items-center justify-center rounded-[36px] bg-emerald-600/20 text-emerald-400 mb-4 transition-transform hover:scale-110 shadow-2xl shadow-emerald-500/20 group">
                    <CheckCircle2 className="w-12 h-12 relative z-10" />
                    <div className="absolute inset-[-10px] rounded-[44px] border-2 border-dashed border-emerald-500/30 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-0 bg-emerald-500/10 blur-[30px] rounded-full scale-150 group-hover:scale-200 transition-transform" />
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 text-[11px] font-black text-emerald-500 uppercase tracking-[0.5em] mb-2">
                        <ShieldCheck className="w-4 h-4" /> DATA INTEGRITY VERIFICATION
                    </div>
                    <h3 className="text-5xl lg:text-6xl font-black text-white tracking-tighter leading-none italic uppercase">FINAL MANIFEST AUDIT</h3>
                    <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed font-semibold opacity-70">
                        Perform a final comprehensive audit of your enterprise credentials before secure synchronization with the SLTS registry.
                    </p>
                </div>
            </div>

            <div className="space-y-12">
                <ReviewSection icon={Fingerprint} title="Contractor Corporate Identity">
                    <ReviewItem label="Full Legal Entity / Business Name" value={data.name} />
                    <ReviewItem label="National Identity / Registration ID" value={data.nic} />
                    <ReviewItem label="Secure Contact Terminal Number" value={data.contactNumber} />
                    <ReviewItem label="Primary Jurisdictional Address" value={data.address} />
                </ReviewSection>

                <ReviewSection icon={Banknote} title="Financial Trust Architecture">
                    <ReviewItem label="Corporate Financial Institution" value={data.bankName} />
                    <ReviewItem label="Verified Bank Account Number" value={data.bankAccountNumber} />
                    <ReviewItem label="Settlement Registry Branch" value={data.bankBranch} />
                </ReviewSection>

                <ReviewSection icon={Users} title="Operational Resource Parameters">
                    <ReviewItem label="Active Field Units Configured" value={data.teams?.length.toString()} />
                    <ReviewItem label="Total Deployed Roster Strength" value={data.teams?.reduce((acc, t) => acc + (t.members?.length || 0), 0).toString()} />
                    <ReviewItem label="Master RTOM / OPMC Jurisdiction" value={data.teams?.[0]?.opmcId === 'inherit' ? 'Global Default' : data.teams?.[0]?.opmcId} />
                </ReviewSection>

                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20 shadow-2xl">
                                <FileText className="w-7 h-7" />
                            </div>
                            <h4 className="text-[12px] font-black uppercase text-white tracking-[0.4em]">MANDATORY REGISTRY SPECIMENS</h4>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-3xl shadow-2xl">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">8 SECURE ATTACHMENTS</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
                        <ReviewDoc label="NIC Front Specimen" url={data.nicFrontUrl} />
                        <ReviewDoc label="NIC Reverse Specimen" url={data.nicBackUrl} />
                        <ReviewDoc label="Registry Portrait" url={data.photoUrl} />
                        <ReviewDoc label="Passbook / Statement" url={data.bankPassbookUrl} />
                        <ReviewDoc label="Operational Fee Slip" url={data.registrationFeeSlipUrl} />
                        <ReviewDoc label="BR Legal Certificate" url={data.brCertUrl} />
                        <ReviewDoc label="Law Enforcement Clearance" url={data.policeReportUrl} />
                        <ReviewDoc label="Jurisdictional GN Cert" url={data.gramaCertUrl} />
                    </div>
                </div>
            </div>

            {/* Smart Declaration Manifest */}
            <div className="relative overflow-hidden p-10 sm:p-14 bg-slate-950/80 rounded-[56px] text-white shadow-[0_45px_100px_rgba(0,0,0,0.6)] mt-16 animate-in slide-in-from-bottom-8 duration-1000 border border-white/10 ring-1 ring-white/10 group/dec">
                <div className="absolute top-0 right-0 p-24 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none group-hover/dec:bg-blue-600/10 transition-all duration-700" />
                <div className="absolute bottom-0 left-0 p-24 bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none group-hover/dec:bg-emerald-600/10 transition-all duration-700" />
                
                <div className="relative flex flex-col lg:flex-row gap-12 items-start lg:items-center">
                    <div className="p-6 bg-white/5 rounded-3xl h-fit shadow-2xl ring-1 ring-white/20 backdrop-blur-3xl border border-white/10 group-hover/dec:scale-110 transition-transform">
                        <Scale className="w-12 h-12 text-blue-500" />
                    </div>
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-0.5 w-10 bg-blue-600 rounded-full" />
                            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-400">LEGAL CERTIFICATION & EMISSION</p>
                        </div>
                        <p className="text-[16px] lg:text-[18px] text-slate-300 leading-relaxed font-semibold tracking-tight">
                            I hereby solemnly certify that all provided data is authenticated and all digital specimens represent verified, genuine copies of original government and institutional registries. Manual interference or false data entry will lead to immediate portal suspension.
                        </p>
                        <div className="flex items-center gap-4 pt-4 text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                            <Zap className="w-4 h-4 animate-pulse" /> Final encryption layer active for secure transmission
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
