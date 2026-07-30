"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Users, Building2, HardHat, Shield, Activity, RefreshCw, Network, Warehouse, Receipt, Settings, HistoryIcon } from "lucide-react";

export default function AdminGuidePage() {
    return (
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS]}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="max-w-6xl mx-auto space-y-8">
                            
                            {/* Page Header */}
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    සම්පූර්ණ පද්ධති පරිපාලන මාර්ගෝපදේශය (Complete Admin Guide)
                                </h1>
                                <p className="text-slate-500 mt-2 text-sm max-w-3xl leading-relaxed">
                                    මෙම ලේඛනයෙන් SLTSERP පද්ධතියේ Admin Panel එක භාවිතා කරන ආකාරය, අලුතින් හඳුන්වා දුන් FSM (Finite State Machine) Architecture එක සහ System Admin කෙනෙකුට ඇති සම්පූර්ණ බලතල පිළිබඳව සියලුම විස්තර ආවරණය කෙරේ.
                                </p>
                            </div>

                            <Tabs defaultValue="architecture" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-200/50 rounded-xl h-auto">
                                    <TabsTrigger value="architecture" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-3">
                                        FSM Architecture & Workflow Engine
                                    </TabsTrigger>
                                    <TabsTrigger value="admin-capabilities" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-3">
                                        Admin Capabilities & Workflows
                                    </TabsTrigger>
                                    <TabsTrigger value="module-guide" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-3">
                                        Admin Module User Guide
                                    </TabsTrigger>
                                </TabsList>

                                {/* TAB 1: FSM Architecture */}
                                <TabsContent value="architecture" className="mt-6 space-y-6">
                                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                                        <div className="h-1 bg-indigo-500 w-full" />
                                        <CardHeader className="pb-3 bg-indigo-50/30">
                                            <CardTitle className="text-xl text-indigo-900">1. මූලික සංකල්ප (Core Principles)</CardTitle>
                                            <CardDescription>පද්ධතියේ Workflow Engine එක Domain Logic එකෙන් සම්පූර්ණයෙන්ම වෙන් කර ඇත.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <div className="space-y-4">
                                                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-4 h-4 text-slate-500"/> Zero-Hardcoding</h4>
                                                    <p className="text-sm text-slate-600 mt-1">Code එක ඇතුලේ if/else දාලා Stages ලියනවා වෙනුවට, <code>ProcessGatePolicy</code> කියන Database Table එකෙන් Routing එක පාලනය කරයි.</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Network className="w-4 h-4 text-slate-500"/> Condition-Based Routing (Rules Engine)</h4>
                                                    <p className="text-sm text-slate-600 mt-1">Data එක මත පදනම්ව (උදා: amount &gt; 500k නම්) Workflow එක වෙනස් පාරවල් වලට යැවීමේ හැකියාව.</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-slate-500"/> Saga Pattern (Rollback Mechanism)</h4>
                                                    <p className="text-sm text-slate-600 mt-1">Database Transactions (prisma.$transaction) භාවිතා කරලා Domain Action එකක් (උදා: බඩු වෙන් කිරීම) Fail වුනොත්, Workflow State එකත් ආපහු පස්සට (Rollback) අදිනවා.</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500"/> Idempotency Engine</h4>
                                                    <p className="text-sm text-slate-600 mt-1">Network අවුලක් නිසා එකම Request එක දෙපාරක් ආවත්, ඒක අල්ලගෙන දෙපාරක් Stock අඩු වෙන එක හරි Double Billing වෙන එක හරි නවත්වනවා.</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                                        <div className="h-1 bg-violet-500 w-full" />
                                        <CardHeader className="pb-3 bg-violet-50/30">
                                            <CardTitle className="text-xl text-violet-900">2. ප්‍රධාන කොටස් (Architecture Components)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="item-1">
                                                    <AccordionTrigger className="text-sm font-semibold text-slate-700">A. JSON Rule Engine</AccordionTrigger>
                                                    <AccordionContent className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg mt-2 border border-slate-100">
                                                        Database එකේ Config කරලා තියෙන JSON Condition එකක්, ඇත්තම Request Data එකත් එක්ක ගැලපෙනවද කියලා බලයි. උදාහරණයක් විදියට <code>{`{"field": "totalValue", "operator": ">=", "value": 500000}`}</code> දුන්නොත්, Material Request එකේ වටිනාකම ලක්ෂ 5 ට වැඩි නම් විතරක් ඒ Policy එක Select වේ.
                                                    </AccordionContent>
                                                </AccordionItem>
                                                <AccordionItem value="item-2">
                                                    <AccordionTrigger className="text-sm font-semibold text-slate-700">B. Process Gate Engine</AccordionTrigger>
                                                    <AccordionContent className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg mt-2 border border-slate-100">
                                                        Approval Instance එකක් පාලනය කරයි. අදාල Stage එකට අදාලව තියෙන ProcessGatePolicy එක හොයාගෙන User කෙනෙක් "Approve" කළාම Instance එක APPROVED කර Webhook එකට Control එක දෙයි.
                                                    </AccordionContent>
                                                </AccordionItem>
                                                <AccordionItem value="item-3">
                                                    <AccordionTrigger className="text-sm font-semibold text-slate-700">C. Domain Action Dispatcher</AccordionTrigger>
                                                    <AccordionContent className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg mt-2 border border-slate-100">
                                                        FSM Engine එකයි අනිත් Modules යි අතර සම්බන්ධය වෙන් කරයි. මේක වැඩ කරන්නේ ප්‍රධාන Prisma Transaction (tx) එක ඇතුලේ. Domain Action එකක් fail වුනොත් සම්පූර්ණ Transaction එකම Rollback වේ. තවද Idempotency Check එක හරහා දෙපාරක් Run වීම වළක්වයි.
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* TAB 2: Admin Capabilities */}
                                <TabsContent value="admin-capabilities" className="mt-6 space-y-6">
                                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                                        <div className="h-1 bg-rose-500 w-full" />
                                        <CardHeader className="pb-3 bg-rose-50/30">
                                            <CardTitle className="text-xl text-rose-900">System Admin ට කළ හැකි දේවල් (Admin Capabilities)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-4">
                                            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                                                <h4 className="font-bold text-slate-800 text-base mb-2 flex items-center gap-2"><Settings className="w-5 h-5 text-rose-500"/> A. Workflow Configuration (ක්‍රියාවලිය පාලනය කිරීම)</h4>
                                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 ml-2 mt-2">
                                                    <li><strong>Gate Policies මාරු කිරීම:</strong> කුමන Approval එක කුමන නිලධාරියාට යා යුතුද යන්න වෙනස් කිරීම.</li>
                                                    <li><strong>Conditions වෙනස් කිරීම:</strong> ලක්ෂ 5 සීමාව, ලක්ෂ 10 දක්වා වැඩි කිරීම වැනි තීරණ (Thresholds) Admin UI එකෙන් මාරු කිරීම.</li>
                                                    <li><strong>Delegations / Auto-Approvals:</strong> යම් නිලධාරියෙක් නිවාඩු ගියහම අදාල Approval එක වෙනත් කෙනෙකුට යොමු කිරීම (RolesToNotify මාරු කිරීමෙන්).</li>
                                                </ul>
                                            </div>
                                            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                                                <h4 className="font-bold text-slate-800 text-base mb-2 flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-rose-500"/> B. Security & System Auditing (ආරක්ෂාව සහ විමර්ශනය)</h4>
                                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 ml-2 mt-2">
                                                    <li><strong>Idempotency Log බැලීම:</strong> Approval එකක් දෙපාරක් Click වෙලා System එකෙන් Block කරලද යන්න පරීක්ෂා කිරීම.</li>
                                                    <li><strong>Audit Trails:</strong> කවුද Approve කළේ, කොයි වෙලාවෙද, ඒ වෙනකොට සිදුවුණු Domain Action එක මොකක්ද යන්න හරියටම බලාගැනීම.</li>
                                                    <li><strong>Saga Error Monitoring:</strong> Stock මදි වෙලා වගේ දේකින් Approval එකක් Rollback වුනොත්, ඒකේ හේතුව Logs හරහා බලාගැනීම.</li>
                                                </ul>
                                            </div>
                                            <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                                                <h4 className="font-bold text-slate-800 text-base mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-rose-500"/> C. Access Control & Segregation of Duties (SoD)</h4>
                                                <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 ml-2 mt-2">
                                                    <li>තමන් දාපු Request එකක් තමන්ටම Approve කරන්න බැරි වෙන විදියට දාලා තියෙන Segregation of Duties Rules බලාගැනීම.</li>
                                                    <li>අලුත් Roles (උදා: PROCUREMENT_MANAGER) එකතු කරලා ඔවුන්ට අදාල Approval Steps අනුයුක්ත කිරීම.</li>
                                                </ul>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                                        <div className="h-1 bg-orange-500 w-full" />
                                        <CardHeader className="pb-3 bg-orange-50/30">
                                            <CardTitle className="text-xl text-orange-900">අලුත් Workflow Step එකක් එකතු කරන්නේ කොහොමද?</CardTitle>
                                            <CardDescription>Code එකේ වෙනස්කම් නොකර UI හෝ Database හරහා Workflows වෙනස් කිරීම.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="item-1">
                                                    <AccordionTrigger className="text-sm font-semibold text-slate-700">ක්‍රමය 1: Admin UI එක හරහා (Super Admin Panel)</AccordionTrigger>
                                                    <AccordionContent className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg mt-2 border border-slate-100 shadow-inner">
                                                        <ol className="list-decimal list-inside space-y-2">
                                                            <li><code>Settings &gt; Workflow Management &gt; Gate Policies</code> කියන UI එකට යන්න.</li>
                                                            <li><strong>Entity Type</strong> එක <code>MATERIAL_REQUEST</code> තෝරන්න.</li>
                                                            <li><strong>From Stage</strong> එක <code>ARM_APPROVAL</code> තෝරන්න.</li>
                                                            <li><strong>Roles to Notify</strong> Dropdown එකෙන් <code>FINANCE_MANAGER</code> තෝරන්න.</li>
                                                            <li><strong>Conditions</strong>: "Total Value &gt;= 50000" කියලා UI එකෙන් හදන්න. (Auto JSON එකට හැරවෙයි).</li>
                                                            <li><strong>Domain Action</strong>: හිස්ව තියන්න. ඊළඟට Finance Approval එකට අදාල Policy එකේදී Domain Action එක <code>TRIGGER_PROCUREMENT</code> කියලා Select කරන්න.</li>
                                                        </ol>
                                                    </AccordionContent>
                                                </AccordionItem>
                                                <AccordionItem value="item-2">
                                                    <AccordionTrigger className="text-sm font-semibold text-slate-700">ක්‍රමය 2: Database එකට කෙලින්ම යෙදීම (No Code Changes)</AccordionTrigger>
                                                    <AccordionContent className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg mt-2 border border-slate-100 shadow-inner">
                                                        <ol className="list-decimal list-inside space-y-2">
                                                            <li><code>ProcessGatePolicy</code> table එකට අලුත් Row එකක් එකතු කරන්න.</li>
                                                            <li><code>fromStatus</code> එක <code>ARM_APPROVAL</code> කියලත්, <code>domainAction</code> එක හිස්වත් තියන්න.</li>
                                                            <li><code>conditions</code> වලට <code>{`{"field": "totalValue", "operator": ">=", "value": 50000}`}</code> දෙන්න.</li>
                                                            <li><code>rolesToNotify</code> එකට <code>["FINANCE_MANAGER"]</code> දෙන්න.</li>
                                                            <li>ඊළඟ Policy එකේ <code>fromStatus</code> එක <code>FINANCE_APPROVAL</code> දාලා, <code>domainAction</code> එක <code>TRIGGER_PROCUREMENT</code> දෙන්න.</li>
                                                        </ol>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* TAB 3: Admin Module Guide */}
                                <TabsContent value="module-guide" className="mt-6 space-y-6">
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-blue-500 w-full" />
                                            <CardHeader className="pb-3 bg-blue-50/30">
                                                <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-500"/> පරිශීලක කළමනාකරණය</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">User Management (/admin/users)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">අලුත් පරිශීලකයන් එකතු කිරීම, ගිණුම් අක්‍රිය කිරීම, මුරපද Reset කිරීම සහ Roles වෙනස් කිරීම මෙතනින් සිදු කෙරේ.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Staff Hierarchy (/admin/staff)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">ආයතනයේ සම්පූර්ණ Org Chart එක හැදීම. කවුද කාටද Report කරන්නේ යන්න (Reporting Structure) මෙතනින් හැදිය හැක.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-emerald-500 w-full" />
                                            <CardHeader className="pb-3 bg-emerald-50/30">
                                                <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-500"/> ආයතනික ව්‍යුහය</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">RTOM Management (/admin/opmcs)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">අලුත් OPMC එකක් හැදුනොත් ඒක System එකට දාලා, ඒකට අදාල Main Stores සහ Sub Stores Link කිරීම මෙතනින් සිදුවේ.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Store Management (/admin/stores)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">සියලුම ගබඩා (Main Stores, Sub Stores) පාලනය කිරීම සහ Store Keeper වරුන් Assign කිරීම.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-amber-500 w-full" />
                                            <CardHeader className="pb-3 bg-amber-50/30">
                                                <CardTitle className="text-base flex items-center gap-2"><HardHat className="w-4 h-4 text-amber-500"/> කොන්ත්‍රාත්කරුවන්</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Contractor Management (/admin/contractors)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">පිටස්තර කොන්ත්‍රාත්කරුවන් සහ ඔවුන්ගේ කණ්ඩායම් System එකට ඇතුලත් කිරීම. Rate Card, සහ Bank Details Update කිරීම.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Contractor Pricing (/admin/contractor-payment)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">Contractor ලට ගෙවන මුදල් අනුපාත (Billing Schedules / Payment Rates) සැකසීම.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-cyan-500 w-full" />
                                            <CardHeader className="pb-3 bg-cyan-50/30">
                                                <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-500"/> ආරක්ෂාව සහ අයිතීන්</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">User Permissions (/admin/user-permissions)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">එක එක User ට System එකේ මොනවද කරන්න පුළුවන් කියන එක (Read/Write/Delete) තනි තනිව පාලනය කිරීම.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Global Roles & Sections (/admin/global-roles)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">සම්පූර්ණ Role එකකටම අදාලව Default Permissions හැදීම සහ පෙනිය යුතු UI Sections තීරණය කිරීම.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-teal-500 w-full" />
                                            <CardHeader className="pb-3 bg-teal-50/30">
                                                <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4 text-teal-500"/> මූල්‍ය සහ මෙහෙයුම්</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">SOD Revenue Config (/admin/sod-revenue)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">Service Orders (SOD) වර්ග අනුව ලැබෙන ආදායම (Revenue Amounts / Base Prices) තීරණය කිරීම.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">SOD Bulk Import (/admin/sod-import)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">Legacy System එකක තියෙන Service Orders ලක්ෂ ගාණක් එකපාර අලුත් System එකට Excel හරහා Import කරගැනීම.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                            <div className="h-1 bg-slate-800 w-full" />
                                            <CardHeader className="pb-3 bg-slate-100">
                                                <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-slate-800"/> පද්ධති නිරීක්ෂණය</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1">
                                                <div className="space-y-3">
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">System Audit Log (/admin/audit-logs)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">System එකේ වෙන හැමදේම (Full Event History) බලාගැනීම. කවුරු හරි වැරැද්දක් කළොත් Audit Log එකෙන් Filter කරලා බලාගත හැක.</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="font-bold text-xs text-slate-800">Phoenix Bridge (/admin/test-extension)</h5>
                                                        <p className="text-[11px] text-slate-600 mt-1">System Error එකක් ආවොත් Developer ලට සහ System Admins ලට එකේ යටින් යන Data මොනවද කියලා බලාගන්න පාවිච්චි කරන Diagnostic Tool එකකි.</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {/* Footer Note */}
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 mt-4">
                                <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm">System Updates</h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        මෙම උපදෙස් මාලාව පද්ධතියේ නවතම (v2.0) යාවත්කාලීන කිරීම් සමග ස්වයංක්‍රීයව වෙනස් වේ. අලුත් Modules එකතු වන විට මේ පිටුවද යාවත්කාලීන වනු ඇත.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
